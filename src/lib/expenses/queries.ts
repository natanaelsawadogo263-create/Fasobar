import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type { ExpenseFiltersInput } from "@/lib/expenses/schemas";
import type { ExpenseListItem, ExpensesPageData } from "@/lib/expenses/types";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isMissingTableError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  const code = error.code ?? "";
  return (
    code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("expenses")
  );
}

type ExpenseRow = {
  id: string;
  area?: string | null;
  category: string;
  label: string;
  amount: number;
  supplier_name: string | null;
  expense_date: string;
  reference: string | null;
  note: string | null;
  status: string;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
};

function mapExpenseRow(row: ExpenseRow): ExpenseListItem {
  const profile = readSingle(row.profiles ?? null);
  const area = row.area === "BAR" ? "BAR" : "CAISSE";

  return {
    id: row.id,
    area,
    category: row.category as ExpenseListItem["category"],
    label: row.label,
    amount: row.amount,
    supplierName: row.supplier_name,
    expenseDate: row.expense_date,
    reference: row.reference,
    note: row.note,
    status: row.status as ExpenseListItem["status"],
    cancelReason: row.cancel_reason,
    createdByName: profile?.full_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listExpenses(
  workspace: WorkspaceContext,
  filters: ExpenseFiltersInput = { status: "all" },
  options: { limit?: number } = {},
): Promise<ExpensesPageData> {
  const empty: ExpensesPageData = {
    expenses: [],
    periodTotal: 0,
    recordedCount: 0,
    cancelledCount: 0,
    kitchenTotal: 0,
    caisseTotal: 0,
    barTotal: 0,
  };

  const supabase = await createClient();
  const limit = options.limit ?? 200;

  let query = supabase
    .from("expenses")
    .select(
      "id, area, category, label, amount, supplier_name, expense_date, reference, note, status, cancel_reason, created_at, updated_at, profiles!expenses_created_by_fkey(full_name)",
    )
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .eq("organization_id", workspace.organizationId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.area) {
    query = query.eq("area", filters.area);
  }

  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.from) {
    query = query.gte("expense_date", filters.from);
  }

  if (filters.to) {
    query = query.lte("expense_date", filters.to);
  }

  let { data, error } = await query;

  // Compat: migration area non appliquée → requêter sans la colonne
  if (error && (error.message ?? "").toLowerCase().includes("area")) {
    const fallback = await supabase
      .from("expenses")
      .select(
        "id, category, label, amount, supplier_name, expense_date, reference, note, status, cancel_reason, created_at, updated_at, profiles!expenses_created_by_fkey(full_name)",
      )
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .eq("organization_id", workspace.organizationId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) {
    if (isMissingTableError(error)) {
      return empty;
    }
    return empty;
  }

  if (!data) {
    return empty;
  }

  let expenses = (data as ExpenseRow[]).map(mapExpenseRow);

  if (filters.search?.trim()) {
    const needle = filters.search.trim().toLowerCase();
    expenses = expenses.filter((item) => {
      const haystack =
        `${item.label} ${item.supplierName ?? ""} ${item.reference ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }

  // Filtre area côté client si la colonne manquait côté DB
  if (filters.area) {
    expenses = expenses.filter((item) => item.area === filters.area);
  }

  const recorded = expenses.filter((item) => item.status === "RECORDED");

  return {
    expenses,
    periodTotal: recorded.reduce((sum, item) => sum + item.amount, 0),
    recordedCount: recorded.length,
    cancelledCount: expenses.filter((item) => item.status === "CANCELLED").length,
    kitchenTotal: recorded
      .filter((item) => item.category === "KITCHEN_PURCHASE")
      .reduce((sum, item) => sum + item.amount, 0),
    caisseTotal: recorded
      .filter((item) => item.area === "CAISSE")
      .reduce((sum, item) => sum + item.amount, 0),
    barTotal: recorded
      .filter((item) => item.area === "BAR")
      .reduce((sum, item) => sum + item.amount, 0),
  };
}
