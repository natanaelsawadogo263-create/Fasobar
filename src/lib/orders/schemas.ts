import { z } from "zod";

export const orderTypeSchema = z.enum(["ON_SITE", "TAKEAWAY"]);

export const orderStatusSchema = z.enum([
  "DRAFT",
  "OPEN",
  "READY_TO_PAY",
  "CANCELLED",
]);

export const orderPaymentStatusSchema = z.enum([
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
]);

export const cartItemSchema = z.object({
  productId: z.string().uuid("Produit invalide."),
  quantity: z.coerce
    .number()
    .positive("La quantité doit être strictement positive."),
  notes: z.string().trim().optional(),
  unitPrice: z.coerce.number().int().nonnegative().optional(),
  productName: z.string().trim().optional(),
  saleUnitId: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().uuid().nullable().optional(),
  ),
  stockFactor: z.coerce.number().positive().optional(),
});

export const createOrderSchema = z.object({
  tableReference: z.string().trim().optional(),
  customerReference: z.string().trim().optional(),
  orderType: orderTypeSchema.default("ON_SITE"),
  notes: z.string().trim().optional(),
});

export const saveOrderSchema = z.object({
  orderId: z.string().uuid("Commande invalide."),
  tableReference: z.string().trim().optional(),
  customerReference: z.string().trim().optional(),
  orderType: orderTypeSchema,
  notes: z.string().trim().optional(),
  targetStatus: orderStatusSchema.default("OPEN"),
  items: z.array(cartItemSchema).min(1, "Ajoutez au moins un article."),
});

export const saveOrderDraftSchema = saveOrderSchema.extend({
  items: z.array(cartItemSchema),
  targetStatus: z.literal("DRAFT"),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().uuid("Commande invalide."),
  reason: z.string().trim().min(3, "Le motif d'annulation est obligatoire."),
  confirmed: z.coerce.boolean(),
});

export const prepareOrderSchema = z.object({
  orderId: z.string().uuid("Commande invalide."),
});

export const adminOrderStatusFilterSchema = z.enum([
  "all",
  "open",
  "paid",
  "cancelled",
]);

export const adminOrderDepartmentFilterSchema = z.enum(["all", "BAR", "KITCHEN"]);

export const adminOrderPeriodFilterSchema = z.enum([
  "all",
  "day",
  "week",
  "month",
  "custom",
]);

export const adminOrderFiltersSchema = z.object({
  status: adminOrderStatusFilterSchema.default("all"),
  department: adminOrderDepartmentFilterSchema.default("all"),
  period: adminOrderPeriodFilterSchema.default("all"),
  cashierId: z.string().uuid().optional().or(z.literal("")),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export type OrderType = z.infer<typeof orderTypeSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderPaymentStatus = z.infer<typeof orderPaymentStatusSchema>;
export type CartItemInput = z.infer<typeof cartItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type SaveOrderInput = z.infer<typeof saveOrderSchema>;
export type AdminOrderStatusFilter = z.infer<typeof adminOrderStatusFilterSchema>;
export type AdminOrderDepartmentFilter = z.infer<typeof adminOrderDepartmentFilterSchema>;
export type AdminOrderPeriodFilter = z.infer<typeof adminOrderPeriodFilterSchema>;
export type AdminOrderFiltersInput = z.infer<typeof adminOrderFiltersSchema>;
