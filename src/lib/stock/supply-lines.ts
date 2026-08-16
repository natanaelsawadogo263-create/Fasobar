import { toStockQuantity } from "@/lib/hardware/product-engine";
import type { ProductPackaging } from "@/lib/products/types";

export type SupplyPurchaseMode = {
  id: string;
  name: string;
  factor: number;
  kind: "unit" | "pack";
  hint: string;
};

export type SupplyLineDraft = {
  clientId: string;
  stockItemId: string;
  productId: string | null;
  productName: string;
  stockUnit: string;
  unitId: string;
  unitName: string;
  factor: number;
  quantity: number;
  purchasePrice: number;
  stockQuantity: number;
  lineTotal: number;
};

export function buildSupplyPurchaseModes(
  stockUnit: string,
  packagings: ProductPackaging[] | undefined,
): SupplyPurchaseMode[] {
  const units = (packagings ?? []).filter((item) => item.name.trim());
  if (units.length === 0) {
    const name = stockUnit || "unité";
    return [
      {
        id: "",
        name,
        factor: 1,
        kind: "unit",
        hint: `1 ${name} = 1 ${name} en stock`,
      },
    ];
  }

  return units.map((unit) => {
    const factor = unit.conversionFactor > 0 ? unit.conversionFactor : 1;
    const kind: "unit" | "pack" = factor > 1 ? "pack" : "unit";
    return {
      id: unit.id,
      name: unit.name,
      factor,
      kind,
      hint:
        factor > 1
          ? `1 ${unit.name} = ${factor} ${unit.baseUnit || stockUnit}`
          : `1 ${unit.name} = 1 ${unit.baseUnit || stockUnit} en stock`,
    };
  });
}

export function computeSupplyLineAmounts(input: {
  quantity: number;
  factor: number;
  purchasePrice: number;
}): { stockQuantity: number; lineTotal: number } {
  const stockQuantity = toStockQuantity(input.quantity, input.factor);
  const lineTotal = Math.round(Math.max(0, input.quantity) * Math.max(0, input.purchasePrice));
  return { stockQuantity, lineTotal };
}

export function buildSupplyLine(input: {
  clientId?: string;
  stockItemId: string;
  productId: string | null;
  productName: string;
  stockUnit: string;
  mode: SupplyPurchaseMode;
  quantity: number;
  purchasePrice: number;
}): SupplyLineDraft {
  const amounts = computeSupplyLineAmounts({
    quantity: input.quantity,
    factor: input.mode.factor,
    purchasePrice: input.purchasePrice,
  });
  return {
    clientId: input.clientId ?? crypto.randomUUID(),
    stockItemId: input.stockItemId,
    productId: input.productId,
    productName: input.productName,
    stockUnit: input.stockUnit,
    unitId: input.mode.id,
    unitName: input.mode.name,
    factor: input.mode.factor,
    quantity: input.quantity,
    purchasePrice: input.purchasePrice,
    stockQuantity: amounts.stockQuantity,
    lineTotal: amounts.lineTotal,
  };
}

export function resolveSupplyPurchaseMode(
  stockUnit: string,
  packagings: ProductPackaging[] | undefined,
  unitLevelId?: string | null,
  unitName?: string,
): SupplyPurchaseMode {
  const modes = buildSupplyPurchaseModes(stockUnit, packagings);
  if (unitLevelId) {
    const byId = modes.find((mode) => mode.id === unitLevelId);
    if (byId) return byId;
  }
  if (unitName?.trim()) {
    const wanted = unitName.trim().toLowerCase();
    const byName = modes.find((mode) => mode.name.toLowerCase() === wanted);
    if (byName) return byName;
  }
  return modes[0]!;
}

export function supplyReceiptTotal(lines: Array<{ lineTotal: number }>): number {
  return lines.reduce((sum, line) => sum + line.lineTotal, 0);
}
