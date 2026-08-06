"use server";

import { revalidatePath } from "next/cache";

import { mapGenericError } from "@/lib/auth/errors";
import { requireAdminContext } from "@/lib/auth/workspace-context";
import {
  cancelExpenseSchema,
  createExpenseSchema,
  updateExpenseSchema,
} from "@/lib/expenses/schemas";
import type { ExpenseActionState } from "@/lib/expenses/types";
import { createClient } from "@/lib/supabase/server";

function revalidateExpensePages() {
  revalidatePath("/application/depenses");
  revalidatePath("/application/rapports");
  revalidatePath("/application/tableau-de-bord");
}

function mapExpenseRpcError(message: string): string {
  if (message.toLowerCase().includes("does not exist")) {
    return "Migration dépenses non appliquée. Contactez un administrateur technique.";
  }
  if (message.includes("Permission insuffisante")) {
    return "Permission insuffisante pour cette opération.";
  }
  if (message.includes("verrouillée")) {
    return "Cette dépense est verrouillée.";
  }
  return message || "Une erreur est survenue.";
}

export async function createExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const workspace = await requireAdminContext();

  const parsed = createExpenseSchema.safeParse({
    category: formData.get("category"),
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
  await requireAdminContext();

  const parsed = updateExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    category: formData.get("category"),
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
  await requireAdminContext();

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
