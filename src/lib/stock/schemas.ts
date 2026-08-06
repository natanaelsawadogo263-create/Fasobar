import { z } from "zod";

import { departmentCodeSchema, productUnitSchema } from "@/lib/products/schemas";

export const stockMovementTypeSchema = z.enum([
  "PURCHASE",
  "MANUAL_ENTRY",
  "SALE",
  "LOSS",
  "BREAKAGE",
  "STAFF_CONSUMPTION",
  "GIFT",
  "INVENTORY_ADJUSTMENT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
]);

export const entryMovementTypeSchema = z.enum(["PURCHASE", "MANUAL_ENTRY"]);

export const lossMovementTypeSchema = z.enum([
  "LOSS",
  "BREAKAGE",
  "STAFF_CONSUMPTION",
  "GIFT",
]);

export const stockStatusSchema = z.enum(["ok", "low", "out", "inactive"]);

export const stockTabSchema = z.enum(["all", "bar", "kitchen", "alerts"]);

export const stockFiltersSchema = z.object({
  tab: stockTabSchema.default("all"),
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(["all", "ok", "low", "out", "inactive"]).default("all"),
});

export const stockEntrySchema = z.object({
  stockItemId: z.string().uuid("Article de stock invalide."),
  movementType: entryMovementTypeSchema.default("PURCHASE"),
  purchasedQuantity: z.coerce
    .number()
    .positive("La quantité achetée doit être strictement positive."),
  conversionFactor: z.coerce
    .number()
    .positive("Le coefficient de conversion doit être strictement positif.")
    .default(1),
  unitCost: z.preprocess((value) => {
    if (value === null || value === undefined || String(value).trim() === "") {
      return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return value;
    }
    // Coût stock en F CFA entier (prix paquet ÷ unités peut donner un décimal)
    return Math.round(parsed);
  }, z.number().int("Le prix unitaire doit être un nombre entier.").min(0).optional()),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  reference: z.string().trim().optional(),
  reason: z.string().trim().optional(),
  entryDate: z.string().trim().optional(),
});

export const stockLossSchema = z.object({
  stockItemId: z.string().uuid("Article de stock invalide."),
  movementType: lossMovementTypeSchema,
  quantity: z.coerce
    .number()
    .positive("La quantité doit être strictement positive."),
  reason: z.string().trim().min(2, "Le motif est obligatoire."),
});

export const stockAdjustmentSchema = z.object({
  stockItemId: z.string().uuid("Article de stock invalide."),
  newQuantity: z.coerce
    .number()
    .min(0, "La quantité corrigée doit être positive ou nulle."),
  reason: z.string().trim().min(2, "Le motif de correction est obligatoire."),
  confirmed: z.coerce.boolean(),
});

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2, "Le nom du fournisseur est obligatoire."),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  active: z.coerce.boolean().default(true),
});

export const updateSupplierSchema = createSupplierSchema.extend({
  supplierId: z.string().uuid("Fournisseur invalide."),
});

export const toggleSupplierStatusSchema = z.object({
  supplierId: z.string().uuid("Fournisseur invalide."),
  active: z.coerce.boolean(),
  confirmed: z.coerce.boolean(),
});

export const createStockItemSchema = z.object({
  name: z.string().trim().min(2, "Le nom de l'article est obligatoire."),
  departmentCode: departmentCodeSchema,
  productId: z.string().uuid().optional().or(z.literal("")),
  unit: productUnitSchema,
  initialQuantity: z.coerce
    .number()
    .min(0, "La quantité initiale doit être positive ou nulle.")
    .default(0),
  minimumQuantity: z.coerce
    .number()
    .min(0, "Le stock minimum doit être positif ou nul.")
    .default(0),
  active: z.coerce.boolean().default(true),
  confirmDuplicateProductLink: z.coerce.boolean().default(false),
});

export const startInventorySchema = z.object({
  departmentCode: departmentCodeSchema,
});

export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;
export type EntryMovementType = z.infer<typeof entryMovementTypeSchema>;
export type LossMovementType = z.infer<typeof lossMovementTypeSchema>;
export type StockStatus = z.infer<typeof stockStatusSchema>;
export type StockTab = z.infer<typeof stockTabSchema>;
export type StockFiltersInput = z.infer<typeof stockFiltersSchema>;
export type StockEntryInput = z.infer<typeof stockEntrySchema>;
export type StockLossInput = z.infer<typeof stockLossSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
