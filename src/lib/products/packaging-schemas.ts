import { z } from "zod";

import { productUnitSchema } from "@/lib/products/schemas";

export const packagingFormItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Le nom du conditionnement est obligatoire."),
  packagingUnit: productUnitSchema,
  conversionFactor: z.coerce
    .number()
    .positive("Le coefficient doit être strictement positif."),
  toDelete: z.boolean().optional(),
});

export const upsertPackagingSchema = z.object({
  productId: z.string().uuid("Produit invalide."),
  name: z.string().trim().min(1, "Le nom du conditionnement est obligatoire."),
  packagingUnit: productUnitSchema,
  conversionFactor: z.coerce
    .number()
    .positive("Le coefficient doit être strictement positif."),
  packagingId: z.string().uuid().optional(),
});

export const deactivatePackagingSchema = z.object({
  packagingId: z.string().uuid("Conditionnement invalide."),
  productId: z.string().uuid("Produit invalide."),
});

export type PackagingFormItem = z.infer<typeof packagingFormItemSchema>;
export type UpsertPackagingInput = z.infer<typeof upsertPackagingSchema>;
export type DeactivatePackagingInput = z.infer<typeof deactivatePackagingSchema>;
