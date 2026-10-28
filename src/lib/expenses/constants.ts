import type { ExpenseArea, ExpenseCategory, ExpenseStatus } from "@/lib/expenses/schemas";

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

export const CUSTOM_CATEGORY_PREFIX = "custom:";

/** Valeur de liste d'une catégorie perso. */
export function customCategoryChoice(id: string): string {
  return `${CUSTOM_CATEGORY_PREFIX}${id}`;
}

/** « custom:<uuid> » → uuid ; sinon null. */
export function parseCustomCategoryChoice(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(CUSTOM_CATEGORY_PREFIX)) return null;
  const id = value.slice(CUSTOM_CATEGORY_PREFIX.length);
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export const EXPENSE_AREA_LABELS: Record<ExpenseArea, string> = {
  CAISSE: "Caisse",
  BAR: "Bar",
};

export const EXPENSE_AREA_STYLES: Record<ExpenseArea, string> = {
  CAISSE: "bg-sky-50 text-sky-700",
  BAR: "bg-emerald-50 text-emerald-700",
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
