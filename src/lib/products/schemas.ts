import { z } from "zod";

import { isValidSlug } from "@/lib/auth/slugs";

export const departmentCodeSchema = z.enum(["BAR", "KITCHEN"]);

export const productUnitSchema = z.enum([
  "BOTTLE",
  "CAN",
  "PORTION",
  "PIECE",
  "KG",
  "LITER",
  "PACK",
  "CASE",
  "SACHET",
  "JERRYCAN",
  "CARTON",
  "BUNDLE",
  "TONNE",
  "METER",
  "ROLL",
  "BARRE",
  "SHEET",
]);

/** Format d'achat d'une boisson : casier, carton ou sachet. */
export const barPackagingUnitSchema = z.enum(["CASE", "CARTON", "SACHET"]);

export const productFormSchema = z.object({
  name: z.string().trim().min(2, "Le nom du produit est obligatoire."),
  departmentCode: departmentCodeSchema,
  categoryId: z.string().uuid("Catégorie invalide."),
  sellingPrice: z.coerce
    .number()
    .int("Le prix doit être un nombre entier.")
    .min(0, "Le prix doit être positif ou nul."),
  unit: productUnitSchema,
  minimumStock: z.coerce
    .number()
    .int("Le stock minimum doit être un nombre entier.")
    .min(0, "Le stock minimum doit être positif ou nul."),
  description: z.string().trim().optional(),
  active: z.coerce.boolean(),
});

export const createProductSchema = productFormSchema
  .omit({ categoryId: true })
  .extend({
    categoryId: z.preprocess(
      (value) =>
        value === "" || value === "__new__" || value == null ? undefined : value,
      z.string().uuid("Catégorie invalide.").optional(),
    ),
    newCategoryName: z.preprocess((value) => {
      const text = typeof value === "string" ? value.trim() : "";
      return text.length > 0 ? text : undefined;
    }, z.string().min(2, "Indiquez le nom de la nouvelle catégorie.").optional()),
    catalogKind: z.enum(["food", "retail"]).optional(),
    sku: z.preprocess((value) => {
      const text = typeof value === "string" ? value.trim() : "";
      return text.length > 0 ? text : undefined;
    }, z.string().max(64).optional()),
    barcode: z.preprocess((value) => {
      const text = typeof value === "string" ? value.trim() : "";
      return text.length > 0 ? text : undefined;
    }, z.string().max(64).optional()),
    purchasePrice: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().int().min(0).optional(),
    ),
    wholesalePrice: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().int().min(0).optional(),
    ),
    purchaseUnit: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      productUnitSchema.optional(),
    ),
    unitsPerPurchase: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().positive().optional(),
    ),
    discountMinQuantity: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
    discountPercent: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().min(0).max(100).optional(),
    ),
    packagingUnit: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      barPackagingUnitSchema.optional(),
    ),
    unitsPerPack: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce
        .number()
        .int("Le nombre d'exemplaires doit être un entier.")
        .positive("Indiquez combien d'exemplaires contient le conditionnement.")
        .optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (!data.categoryId && !data.newCategoryName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sélectionnez une catégorie ou créez-en une.",
        path: ["categoryId"],
      });
    }

    if (data.departmentCode !== "BAR" || data.catalogKind === "retail") {
      return;
    }
    if (!data.packagingUnit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indiquez le format d'achat (casier, carton ou sachet).",
        path: ["packagingUnit"],
      });
    }
    if (data.unitsPerPack == null || Number.isNaN(data.unitsPerPack)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indiquez le nombre d'exemplaires dans le conditionnement.",
        path: ["unitsPerPack"],
      });
    }
  });

export const updateProductSchema = productFormSchema.extend({
  productId: z.string().uuid("Produit invalide."),
  sku: z.preprocess((value) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length > 0 ? text : undefined;
  }, z.string().max(64).optional()),
  barcode: z.preprocess((value) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length > 0 ? text : undefined;
  }, z.string().max(64).optional()),
  purchasePrice: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(0).optional(),
  ),
  wholesalePrice: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(0).optional(),
  ),
  purchaseUnit: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    productUnitSchema.optional(),
  ),
  unitsPerPurchase: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().positive().optional(),
  ),
  discountMinQuantity: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  discountPercent: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().min(0).max(100).optional(),
  ),
});

export const updateProductPriceSchema = z.object({
  productId: z.string().uuid("Produit invalide."),
  sellingPrice: z.coerce
    .number()
    .int("Le prix doit être un nombre entier.")
    .min(0, "Le prix doit être positif ou nul."),
});

export const toggleProductStatusSchema = z.object({
  productId: z.string().uuid("Produit invalide."),
  active: z.coerce.boolean(),
});

export const productSlugSchema = z
  .string()
  .trim()
  .refine(isValidSlug, "Slug produit invalide.");

export type DepartmentCode = z.infer<typeof departmentCodeSchema>;
export type ProductUnit = z.infer<typeof productUnitSchema>;
export type BarPackagingUnit = z.infer<typeof barPackagingUnitSchema>;
export type ProductFormInput = z.infer<typeof productFormSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;

export type ProductTab = "all" | "bar" | "kitchen" | "unavailable";

export const productFiltersSchema = z.object({
  tab: z.enum(["all", "bar", "kitchen", "unavailable"]).default("all"),
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional().or(z.literal("")),
});

export type ProductFiltersInput = z.infer<typeof productFiltersSchema>;
