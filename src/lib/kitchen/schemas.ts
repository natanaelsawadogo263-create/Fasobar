import { z } from "zod";

export const kitchenStatusSchema = z.enum([
  "TO_PREPARE",
  "IN_PREPARATION",
  "READY",
  "SERVED",
]);

export const updateKitchenStatusSchema = z.object({
  orderId: z.string().uuid("Commande invalide."),
  status: kitchenStatusSchema,
});

export type KitchenStatus = z.infer<typeof kitchenStatusSchema>;
