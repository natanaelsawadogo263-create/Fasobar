import { z } from "zod";

export const paymentMethodSchema = z.enum([
  "CASH",
  "ORANGE_MONEY",
  "MOOV_MONEY",
  "TELECEL_MONEY",
  "CARD",
  "OTHER",
]);

export const paymentLineSchema = z.object({
  method: paymentMethodSchema,
  amountApplied: z.coerce
    .number()
    .int("Le montant doit être un entier.")
    .positive("Le montant doit être strictement positif."),
  amountReceived: z.coerce
    .number()
    .int("Le montant reçu doit être un entier.")
    .min(0, "Le montant reçu doit être positif ou nul.")
    .optional(),
  transactionReference: z.string().trim().optional(),
  provider: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const openCashSessionSchema = z.object({
  openingCashAmount: z.coerce
    .number()
    .int("Le fond de caisse doit être un entier.")
    .min(0, "Le fond de caisse doit être positif ou nul."),
  openingNote: z.string().trim().optional(),
});

export const closeCashSessionSchema = z.object({
  sessionId: z.string().uuid("Session invalide."),
  countedCashAmount: z.coerce
    .number()
    .int("Le montant compté doit être un entier.")
    .min(0, "Le montant compté doit être positif ou nul."),
  closingNote: z.string().trim().optional(),
  confirmed: z.coerce.boolean(),
});

export const recordPaymentsSchema = z.object({
  orderId: z.string().uuid("Commande invalide."),
  payments: z.array(paymentLineSchema).min(1, "Ajoutez au moins un paiement."),
  idempotencyKey: z.string().uuid().optional(),
});

export const voidPaymentSchema = z.object({
  paymentId: z.string().uuid("Paiement invalide."),
  reason: z.string().trim().min(3, "Le motif est obligatoire."),
  confirmed: z.coerce.boolean(),
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentLineInput = z.infer<typeof paymentLineSchema>;
