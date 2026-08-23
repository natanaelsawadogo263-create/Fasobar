export type ProductActionState = {
  error?: string;
  success?: string;
};

export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sellingPrice: number;
  unit: string;
  stockUnitLabel?: string | null;
  brandName?: string | null;
  minimumStock: number;
  active: boolean;
  /** URL d'affichage préférée (optimisée > originale > legacy). */
  imageUrl: string | null;
  imageOriginalUrl: string | null;
  imageOptimizedUrl: string | null;
  departmentCode: string;
  departmentName: string;
  categoryId: string;
  categoryName: string;
  sku?: string | null;
  barcode?: string | null;
  purchasePrice?: number | null;
  wholesalePrice?: number | null;
  purchaseUnit?: string | null;
  unitsPerPurchase?: number | null;
  discountMinQuantity?: number | null;
  discountPercent?: number | null;
};

export type CategoryOption = {
  id: string;
  name: string;
  departmentCode: string;
  active?: boolean;
  productCount?: number;
};

export type DepartmentOption = {
  id: string;
  code: string;
  name: string;
};

export type ProductStats = {
  total: number;
  barCount: number;
  kitchenCount: number;
  inactiveCount: number;
};

export type ProductPackaging = {
  id: string;
  productId: string;
  name: string;
  packagingUnit: string;
  baseUnit: string;
  conversionFactor: number;
  active: boolean;
  sellingPrice?: number | null;
  allowDecimal?: boolean;
  /** Code-barres propre à ce conditionnement (ex. carton de 6) — distinct du code produit. */
  barcode?: string | null;
};
