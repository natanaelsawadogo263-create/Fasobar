import type { ExpenseCategory, ExpenseStatus } from "@/lib/expenses/schemas";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  KITCHEN_PURCHASE: "Achats Cuisine",
  GAS: "Gaz",
  CHARCOAL: "Charbon",
  TRANSPORT: "Transport",
  MAINTENANCE: "Entretien",
  PAYROLL: "Personnel",
  RENT: "Loyer",
  WATER: "Eau",
  ELECTRICITY: "Électricité",
  OTHER: "Autres",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  RECORDED: "Enregistrée",
  CANCELLED: "Annulée",
};

export const EXPENSE_STATUS_STYLES: Record<ExpenseStatus, string> = {
  RECORDED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-600",
};

export function formatPriceXof(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}
