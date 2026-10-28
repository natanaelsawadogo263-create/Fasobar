"use server";

import { revalidatePath } from "next/cache";

import { mapGenericError } from "@/lib/auth/errors";
import { requireExpenseMutationContext } from "@/lib/auth/workspace-context";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { parseCustomCategoryChoice } from "@/lib/expenses/constants";
import {
  cancelExpenseSchema,
  createExpenseSchema,
  updateExpenseSchema,
  type ExpenseArea,
} from "@/lib/expenses/schemas";
import type { ExpenseActionState } from "@/lib/expenses/types";
import type { UserSpace } from "@/lib/auth/roles";
import { hardwarePermissions } from "@/lib/hardware/permissions";

function revalidateExpensePages() {
  revalidatePath("/application/depenses");
  revalidatePath("/application/rapports");
  revalidatePath("/application/tableau-de-bord");
  revalidatePath("/application/bar");
  revalidatePath("/application/caisse");
}

function mapExpenseRpcError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("does not exist") ||
    lower.includes("p_area") ||
    lower.includes("could not find")
  ) {
    return "Migration dépenses (Caisse/Bar) non appliquée. Exécutez 20260811140000_expense_area.sql et 20260811140100_expense_area_role_access.sql.";
  }
  if (message.includes("Permission insuffisante")) {
    return "Permission insuffisante pour cette opération.";
  }
  if (message.includes("verrouillée")) {
    return "Cette dépense est verrouillée.";
  }
  return message || "Une erreur est survenue.";
}

function resolveAreaForSpace(
  space: UserSpace,
  requested: ExpenseArea,
): ExpenseArea {
  if (space === "bar_manager") return "BAR";
  if (space === "cashier_kitchen" || space === "delivery") return "CAISSE";
  return requested;
}

const NEW_CATEGORY_CHOICE = "__new__";

/** Bar / Caisse–Cuisine : pas de catégorie côté UI (défaut OTHER à la création). */
function resolveCategoryForSpace(
  space: UserSpace,
  requested: unknown,
) {
  // Catégorie perso ou nouvelle catégorie : enregistrée en OTHER, rattachée ensuite.
  if (requested === NEW_CATEGORY_CHOICE || parseCustomCategoryChoice(requested)) return "OTHER";
  if (space === "admin") return requested;
  if (typeof requested === "string" && requested.length > 0) return requested;
  return "OTHER";
}

const CUSTOM_CATEGORY_UNAVAILABLE =
  "Les catégories personnalisées ne sont pas encore activées sur le serveur (migration 20261028120000_expense_custom_categories.sql).";

type CustomCategoryResolution =
  | { kind: "none" }
  | { kind: "custom"; id: string }
  | { kind: "error"; error: string };

/**
 * Admin uniquement : catégorie perso choisie (« custom:<id> ») ou créée à la volée
 * (« __new__ » + newCategoryName). Les autres espaces ne touchent pas aux catégories.
 */
async function resolveCustomCategory(
  workspace: WorkspaceContext,
  formData: FormData,
): Promise<CustomCategoryResolution> {
  if (workspace.userSpace !== "admin") return { kind: "none" };
  const requested = formData.get("category");

  const existing = parseCustomCategoryChoice(requested);
  if (existing) return { kind: "custom", id: existing };
  if (requested !== NEW_CATEGORY_CHOICE) return { kind: "none" };

  const name = String(formData.get("newCategoryName") ?? "").trim();
  if (name.length < 2 || name.length > 60) {
    return { kind: "error", error: "Le nom de la catégorie doit faire entre 2 et 60 caractères." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_expense_category", {
    p_establishment_id: workspace.establishmentId,
    p_name: name,
  });
  if (error || typeof data !== "string") {
    const message = error?.message ?? "";
    if (/could not find|does not exist/i.test(message)) {
      return { kind: "error", error: CUSTOM_CATEGORY_UNAVAILABLE };
    }
    return { kind: "error", error: mapExpenseRpcError(message || "Catégorie non créée.") };
  }
  return { kind: "custom", id: data };
}

async function applyCustomCategory(
  expenseId: string,
  categoryId: string | null,
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_expense_custom_category", {
    p_expense_id: expenseId,
    p_category_id: categoryId,
  });
  if (!error) return null;
  if (/could not find|does not exist/i.test(error.message ?? "")) {
    // Sans la migration, rien à détacher ; rattacher est déjà bloqué plus haut.
    return categoryId ? CUSTOM_CATEGORY_UNAVAILABLE : null;
  }
  return mapExpenseRpcError(error.message);
}

export async function deleteExpenseCategoryAction(
  categoryId: string,
): Promise<ExpenseActionState> {
  const workspace = await requireExpenseMutationContext();
  if (workspace.userSpace !== "admin") {
    return { error: "Seul l'administrateur gère les catégories." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(categoryId)) return { error: "Catégorie invalide." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_expense_category", {
    p_category_id: categoryId,
  });
  if (error) {
    if (/could not find|does not exist/i.test(error.message ?? "")) {
      return { error: CUSTOM_CATEGORY_UNAVAILABLE };
    }
    return { error: mapExpenseRpcError(error.message) };
  }

  revalidateExpensePages();
  return { success: "Catégorie supprimée. Ses dépenses passent dans « Autres »." };
}

export async function createExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const workspace = await requireExpenseMutationContext();

    const perms = hardwarePermissions({
      activityCode: workspace.activityCode,
      userSpace: workspace.userSpace,
      organizationRole: workspace.organizationRole,
      establishmentRole: workspace.establishmentRole,
    });
    if (perms.enabled && !perms.canCreateExpense) {
      return { error: "Le Caisse-Vendeur ne peut pas enregistrer une dépense." };
    }

    const parsed = createExpenseSchema.safeParse({
    area: formData.get("area") || "CAISSE",
    category: resolveCategoryForSpace(workspace.userSpace, formData.get("category")),
    label: formData.get("label"),
    amount: formData.get("amount"),
    supplierName: formData.get("supplierName") || undefined,
    expenseDate: formData.get("expenseDate"),
    reference: formData.get("reference") || undefined,
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const area = resolveAreaForSpace(workspace.userSpace, parsed.data.area);

  // Avant la dépense : une catégorie impossible à créer ne laisse pas de dépense mal rangée.
  const custom = await resolveCustomCategory(workspace, formData);
  if (custom.kind === "error") return { error: custom.error };

  const supabase = await createClient();
  const { data: expenseId, error } = await supabase.rpc("record_expense", {
    p_establishment_id: workspace.establishmentId,
    p_category: parsed.data.category,
    p_label: parsed.data.label,
    p_amount: parsed.data.amount,
    p_supplier_name: parsed.data.supplierName ?? null,
    p_expense_date: parsed.data.expenseDate,
    p_reference: parsed.data.reference ?? null,
    p_note: parsed.data.note ?? null,
    p_area: area,
  });

  if (error) {
    return { error: mapExpenseRpcError(error.message || mapGenericError(error)) };
  }

  if (custom.kind === "custom" && typeof expenseId === "string") {
    const customError = await applyCustomCategory(expenseId, custom.id);
    if (customError) {
      revalidateExpensePages();
      return { error: `Dépense enregistrée dans « Autres » : ${customError}` };
    }
  }

  revalidateExpensePages();
  return { success: "Dépense enregistrée." };
}

export async function updateExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const workspace = await requireExpenseMutationContext();

  const parsed = updateExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    area: formData.get("area") || "CAISSE",
    category: resolveCategoryForSpace(workspace.userSpace, formData.get("category")),
    label: formData.get("label"),
    amount: formData.get("amount"),
    supplierName: formData.get("supplierName") || undefined,
    expenseDate: formData.get("expenseDate"),
    reference: formData.get("reference") || undefined,
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const area = resolveAreaForSpace(workspace.userSpace, parsed.data.area);

  const custom = await resolveCustomCategory(workspace, formData);
  if (custom.kind === "error") return { error: custom.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_expense", {
    p_expense_id: parsed.data.expenseId,
    p_category: parsed.data.category,
    p_label: parsed.data.label,
    p_amount: parsed.data.amount,
    p_supplier_name: parsed.data.supplierName ?? null,
    p_expense_date: parsed.data.expenseDate,
    p_reference: parsed.data.reference ?? null,
    p_note: parsed.data.note ?? null,
    p_area: area,
  });

  if (error) {
    return { error: mapExpenseRpcError(error.message || mapGenericError(error)) };
  }

  // L'admin choisit la catégorie : perso → rattache ; fixe → détache.
  if (workspace.userSpace === "admin") {
    const customError = await applyCustomCategory(
      parsed.data.expenseId,
      custom.kind === "custom" ? custom.id : null,
    );
    if (customError) {
      revalidateExpensePages();
      return { error: customError };
    }
  }

  revalidateExpensePages();
  return { success: "Dépense mise à jour." };
}

export async function cancelExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  await requireExpenseMutationContext();

  const parsed = cancelExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_expense", {
    p_expense_id: parsed.data.expenseId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return { error: mapExpenseRpcError(error.message || mapGenericError(error)) };
  }

  revalidateExpensePages();
  return { success: "Dépense annulée (historique conservé)." };
}
