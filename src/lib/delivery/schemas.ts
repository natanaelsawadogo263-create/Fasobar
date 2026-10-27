import { z } from "zod";

import { paymentMethodSchema } from "@/lib/payments/schemas";

const quantitySchema = z.coerce
  .number({ message: "Quantité invalide." })
  .positive("La quantité doit être supérieure à 0.")
  .max(1_000_000, "Quantité trop grande.");

export const deliveryItemsSchema = z
  .array(
    z.object({
      productId: z.string().uuid("Article invalide."),
      quantity: quantitySchema,
      /** Format vendu (carton, pack…) ; absent = à l'unité. */
      saleUnitId: z.string().uuid("Format de vente invalide.").optional(),
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

/** Encaissement d'une livraison par la caisse. */
export const cashDeliveryOrderSchema = deliveryOrderIdSchema
  .extend({
    method: paymentMethodSchema,
    amountReceived: z.coerce
      .number({ message: "Montant reçu invalide." })
      .int("Montant reçu invalide.")
      .min(0, "Montant reçu invalide.")
      .optional(),
    transactionReference: optionalText(100),
  })
  .transform((value) => ({
    ...value,
    // Le montant reçu (rendu monnaie) ne concerne que les espèces.
    amountReceived: value.method === "CASH" ? value.amountReceived : undefined,
  }));

export type DeliveryItemsInput = z.infer<typeof deliveryItemsSchema>;

/** Format attendu par les fonctions SQL (`p_items`). */
export function toRpcItems(items: DeliveryItemsInput) {
  return items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
    ...(item.saleUnitId ? { unit_level_id: item.saleUnitId } : {}),
  }));
}
