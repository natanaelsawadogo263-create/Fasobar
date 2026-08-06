import { z } from "zod";

export const expenseCategorySchema = z.enum([
  "KITCHEN_PURCHASE",
  "GAS",
  "CHARCOAL",
  "TRANSPORT",
  "MAINTENANCE",
  "PAYROLL",
  "RENT",
  "WATER",
  "ELECTRICITY",
  "OTHER",
]);

export const expenseStatusSchema = z.enum(["RECORDED", "CANCELLED"]);

export const expenseFormSchema = z.object({
  category: expenseCategorySchema,
  label: z.string().trim().min(2, "Le libellé est obligatoire."),
  amount: z.coerce
    .number()
    .int("Le montant doit être un entier XOF.")
    .positive("Le montant doit être strictement positif."),
  supplierName: z.string().trim().optional(),
  expenseDate: z.string().trim().min(1, "La date est obligatoire."),
  reference: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export const createExpenseSchema = expenseFormSchema;

export const updateExpenseSchema = expenseFormSchema.extend({
  expenseId: z.string().uuid("Dépense invalide."),
});

export const cancelExpenseSchema = z.object({
  expenseId: z.string().uuid("Dépense invalide."),
  reason: z.string().trim().min(3, "Le motif d'annulation est obligatoire."),
});

export const expenseFiltersSchema = z.object({
  category: expenseCategorySchema.optional().or(z.literal("")),
  status: z.enum(["all", "RECORDED", "CANCELLED"]).default("all"),
  search: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
export type ExpenseStatus = z.infer<typeof expenseStatusSchema>;
export type ExpenseFormInput = z.infer<typeof expenseFormSchema>;
export type ExpenseFiltersInput = z.infer<typeof expenseFiltersSchema>;
