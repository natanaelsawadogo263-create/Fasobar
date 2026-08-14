"use server";

import { revalidatePath } from "next/cache";

import { mapGenericError } from "@/lib/auth/errors";
import { requireExpenseMutationContext } from "@/lib/auth/workspace-context";
import {
  cancelExpenseSchema,
  createExpenseSchema,
  updateExpenseSchema,
  type ExpenseArea,
} from "@/lib/expenses/schemas";
import type { ExpenseActionState } from "@/lib/expenses/types";
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
  space: "admin" | "cashier_kitchen" | "bar_manager",
  requested: ExpenseArea,
): ExpenseArea {
  if (space === "bar_manager") return "BAR";
  if (space === "cashier_kitchen") return "CAISSE";
  return requested;
}

/** Bar / Caisse–Cuisine : pas de catégorie côté UI (défaut OTHER à la création). */
function resolveCategoryForSpace(
  space: "admin" | "cashier_kitchen" | "bar_manager",
  requested: unknown,
) {
  if (space === "admin") return requested;
  if (typeof requested === "string" && requested.length > 0) return requested;
  return "OTHER";
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

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_expense", {
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
