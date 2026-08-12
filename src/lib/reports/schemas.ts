import { z } from "zod";

export const reportTypeSchema = z.enum([
  "ventes",
  "commandes",
  "produits_vendus",
  "stock_boissons",
  "approvisionnements",
  "pertes_casse",
  "depenses",
  "depenses_cuisine",
  "benefices",
  "sessions_caisse",
  "ecarts_caisse",
  "activite_utilisateurs",
]);

export const reportFiltersSchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export type ReportType = z.infer<typeof reportTypeSchema>;
export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;
