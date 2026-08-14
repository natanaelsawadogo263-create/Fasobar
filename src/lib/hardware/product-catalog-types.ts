export type HardwareBrand = {
  id: string;
  name: string;
  logoUrl: string | null;
  active: boolean;
};

export type HardwareAttribute = {
  id: string;
  name: string;
  active: boolean;
};

export type HardwareUnitLevel = {
  id?: string;
  clientId: string;
  name: string;
  parentClientId: string | null;
  containsQty: number;
  isBase: boolean;
  purchasable: boolean;
  sellable: boolean;
  purchasePrice: number;
  sellingPrice: number;
};

export type HardwareVariantDraft = {
  clientId: string;
  id?: string;
  attributeId: string;
  attributeValue: string;
  internalRef: string;
  minimumStock: number;
  units: HardwareUnitLevel[];
};

export type HardwareProductDraft = {
  productId?: string;
  imageUrl?: string | null;
  name: string;
  categoryId: string;
  newCategoryName: string;
  brandId: string;
  newBrandName: string;
  modelName: string;
  internalRef: string;
  description: string;
  stockUnit: string;
  customStockUnit: string;
  fractionable: boolean;
  fractionPrecision: number;
  minimumStock: number;
  useVariants: boolean;
  variants: HardwareVariantDraft[];
  units: HardwareUnitLevel[];
};

export function emptyHardwareUnits(stockUnit: string): HardwareUnitLevel[] {
  return [
    {
      clientId: "base",
      name: stockUnit || "pièce",
      parentClientId: null,
      containsQty: 1,
      isBase: true,
      purchasable: false,
      sellable: true,
      purchasePrice: 0,
      sellingPrice: 0,
    },
  ];
}

export function emptyHardwareDraft(categoryId = ""): HardwareProductDraft {
  return {
    name: "",
    categoryId,
    newCategoryName: "",
    brandId: "",
    newBrandName: "",
    modelName: "",
    internalRef: "",
    description: "",
    stockUnit: "pièce",
    customStockUnit: "",
    fractionable: false,
    fractionPrecision: 0.1,
    minimumStock: 0,
    useVariants: false,
    variants: [],
    units: emptyHardwareUnits("pièce"),
  };
}
