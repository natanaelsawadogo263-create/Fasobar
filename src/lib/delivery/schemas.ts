import { z } from "zod";

const quantitySchema = z.coerce
  .number({ message: "Quantité invalide." })
  .positive("La quantité doit être supérieure à 0.")
  .max(1_000_000, "Quantité trop grande.");

export const deliveryItemsSchema = z
  .array(
    z.object({
      productId: z.string().uuid("Article invalide."),
      quantity: quantitySchema,
    }),
  )
  .min(1, "Ajoutez au moins un article.")
  .max(200, "Trop d’articles dans une seule opération.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .transform((value) => (value ? value : undefined));

export const createDeliveryOrderSchema = z.object({
  items: deliveryItemsSchema,
  customerName: optionalText(120),
  customerPhone: optionalText(40),
  deliveryAddress: optionalText(300),
  note: optionalText(500),
});

export const courierStockOperationSchema = z.object({
  courierId: z.string().uuid("Livreur invalide."),
  items: deliveryItemsSchema,
  note: optionalText(300),
});

export const deliveryOrderIdSchema = z.object({
  orderId: z.string().uuid("Commande invalide."),
});

export const cancelDeliveryOrderSchema = deliveryOrderIdSchema.extend({
  reason: optionalText(300),
});

export type DeliveryItemsInput = z.infer<typeof deliveryItemsSchema>;

/** Format attendu par les fonctions SQL (`p_items`). */
export function toRpcItems(items: DeliveryItemsInput) {
  return items.map((item) => ({ product_id: item.productId, quantity: item.quantity }));
}
