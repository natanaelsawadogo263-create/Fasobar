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
};

export type CategoryOption = {
  id: string;
  name: string;
  departmentCode: string;
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
};
