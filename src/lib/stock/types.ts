import type { StockStatus } from "@/lib/stock/schemas";

export type StockActionState = {
  error?: string;
  success?: string;
};

export type StockListItem = {
  id: string;
  name: string;
  unit: string;
  currentQuantity: number;
  minimumQuantity: number;
  active: boolean;
  departmentCode: string;
  departmentName: string;
  departmentId: string;
  productId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  stockUnitLabel?: string | null;
  status: StockStatus;
  estimatedUnitCost: number | null;
};

export type SupplierOption = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  active: boolean;
  departmentCode: "BAR" | "KITCHEN";
};

export type StockMovementItem = {
  id: string;
  type: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: number | null;
  totalCost: number | null;
  reference: string | null;
  reason: string | null;
  createdAt: string;
  createdByName: string | null;
};

export type StockStats = {
  barItemCount: number;
  kitchenItemCount: number;
  alertCount: number;
  estimatedValue: number;
};

export type InventorySessionItem = {
  id: string;
  status: string;
  departmentCode: string;
  departmentName: string;
  startedAt: string;
  completedAt: string | null;
  startedByName: string | null;
  lineCount: number;
};

export type StockProductOption = {
  id: string;
  name: string;
  departmentCode: string;
  unit: string;
  linkedStockItemId: string | null;
  linkedStockItemName: string | null;
};

export type RecentSupplyEntry = {
  id: string;
  stockItemName: string;
  departmentName: string;
  departmentCode: "BAR" | "KITCHEN" | string;
  quantity: number;
  unit: string;
  totalCost: number | null;
  reference: string | null;
  supplierName: string | null;
  createdAt: string;
};

export type SupplyReceiptListItem = {
  id: string;
  supplierName: string;
  receivedOn: string;
  status: "DRAFT" | "VALIDATED";
  notes: string | null;
  totalAmount: number;
  lineCount: number;
  departmentCodes: Array<"BAR" | "KITCHEN">;
  createdAt: string;
};

export type SupplyReceiptDetail = {
  id: string;
  supplierId: string;
  supplierName: string;
  receivedOn: string;
  notes: string | null;
  status: "DRAFT" | "VALIDATED";
  lines: Array<{
    stockItemId: string;
    productId: string | null;
    productName: string;
    stockUnit: string;
    unitLevelId: string | null;
    unitName: string;
    purchasedQuantity: number;
    conversionFactor: number;
    stockQuantity: number;
    purchasePrice: number;
    lineTotal: number;
  }>;
};

export type StockLossEntry = {
  id: string;
  type: string;
  stockItemName: string;
  departmentName: string;
  quantity: number;
  unit: string;
  reason: string | null;
  createdAt: string;
  createdByName: string | null;
};
