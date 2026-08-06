export type BarSessionProductQty = {
  productName: string;
  quantity: number;
  unit?: string;
  type?: string;
};

export type BarSessionTheoreticalStockItem = {
  stockItemId: string;
  productName: string;
  unit: string;
  quantity: number;
  minimumQuantity: number;
  isLow: boolean;
};

/** Bilan calculé automatiquement à la clôture (ou en aperçu). */
export type BarSessionClosingSummary = {
  sessionId: string;
  openedAt: string;
  closedAt: string;
  openedBy: string | null;
  closedBy: string | null;
  closingNote: string | null;
  ordersReceivedCount: number;
  ordersServedCount: number;
  ordersValidatedCount: number;
  ordersPendingCount: number;
  drinksOutQty: number;
  drinksByProduct: BarSessionProductQty[];
  stockEntriesCount: number;
  stockEntriesCost: number;
  stockEntriesByProduct: BarSessionProductQty[];
  stockLossesCount: number;
  stockLossesQty: number;
  stockLossesByProduct: BarSessionProductQty[];
  stockCorrectionsCount: number;
  stockCorrectionsByProduct: BarSessionProductQty[];
  lowStockCount: number;
  theoreticalStock: BarSessionTheoreticalStockItem[];
};

export type BarSessionDetail = {
  id: string;
  status: "OPEN" | "CLOSED" | "CANCELLED" | string;
  openedAt: string;
  closedAt: string | null;
  openingNote: string | null;
  closingNote: string | null;
  openedById: string;
  openedByName: string | null;
  closedById: string | null;
  closedByName: string | null;
  isOwnSession: boolean;
  ordersReadyCount: number;
  ordersPendingCount: number;
  stockEntriesCount: number;
  stockEntriesCost: number;
  stockLossesCount: number;
  stockLossesQty: number;
  lowStockCount: number;
  closingOrdersPendingCount: number | null;
  closingStockEntriesCount: number | null;
  closingStockEntriesCost: number | null;
  closingStockLossesCount: number | null;
  closingStockLossesQty: number | null;
  closingLowStockCount: number | null;
  closingSummary: BarSessionClosingSummary | null;
};

export type BarSessionActionState = {
  error?: string;
  success?: string;
  sessionId?: string;
  summary?: BarSessionClosingSummary;
};
