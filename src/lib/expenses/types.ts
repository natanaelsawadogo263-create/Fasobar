import type { ExpenseArea, ExpenseCategory, ExpenseStatus } from "@/lib/expenses/schemas";

export type ExpenseActionState = {
  error?: string;
  success?: string;
};

export type ExpenseListItem = {
  id: string;
  area: ExpenseArea;
  category: ExpenseCategory;
  /** Catégorie créée par l'admin (category vaut alors OTHER). */
  customCategoryId: string | null;
  customCategoryName: string | null;
  label: string;
  amount: number;
  supplierName: string | null;
  expenseDate: string;
  reference: string | null;
  note: string | null;
  status: ExpenseStatus;
  cancelReason: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseCustomCategory = {
  id: string;
  name: string;
};

export type ExpensesPageData = {
  expenses: ExpenseListItem[];
  periodTotal: number;
  recordedCount: number;
  cancelledCount: number;
  kitchenTotal: number;
  caisseTotal: number;
  barTotal: number;
};
