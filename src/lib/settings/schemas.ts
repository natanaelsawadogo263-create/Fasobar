import { z } from "zod";

import { SERVICE_SCOPES } from "@/lib/settings/service-scope";

export const updateEstablishmentSettingsSchema = z.object({
  name: z.string().trim().min(2, "Le nom de l'établissement est obligatoire."),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  currency: z.string().trim().min(1, "La devise est obligatoire.").default("XOF"),
  timezone: z.string().trim().min(1, "Le fuseau horaire est obligatoire.").default("Africa/Ouagadougou"),
  receiptHeader: z.string().trim().optional(),
  receiptFooter: z.string().trim().optional(),
  thankYouMessage: z.string().trim().optional(),
  defaultMinimumStock: z.coerce
    .number()
    .int("Le seuil de stock doit être un nombre entier.")
    .min(0, "Le seuil de stock doit être positif ou nul.")
    .default(5),
  serviceScope: z.enum(SERVICE_SCOPES).default("BOTH"),
});

export type UpdateEstablishmentSettingsInput = z.infer<typeof updateEstablishmentSettingsSchema>;
