import { z } from "zod";

export const barPrepStatusSchema = z.enum([
  "TO_PREPARE",
  "IN_PREPARATION",
  "READY",
]);

export const updateBarStatusSchema = z.object({
  orderId: z.string().uuid("Commande invalide."),
  status: barPrepStatusSchema,
});

export const openBarSessionSchema = z.object({
  openingNote: z.string().trim().optional(),
});

export const closeBarSessionSchema = z.object({
  sessionId: z.string().uuid("Session invalide."),
  closingNote: z.string().trim().optional(),
  confirmed: z.coerce.boolean(),
});

export const barHistoryTypeSchema = z.enum([
  "all",
  "entry",
  "loss",
  "inventory",
  "correction",
]);

export type BarPrepStatus = z.infer<typeof barPrepStatusSchema>;
export type BarHistoryTypeFilter = z.infer<typeof barHistoryTypeSchema>;
