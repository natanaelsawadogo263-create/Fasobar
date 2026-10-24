export type DeliveryOrderStatus = "PENDING" | "ACCEPTED" | "DELIVERED" | "CANCELLED";

export type CourierStockMovementType = "ALLOCATION" | "RETURN" | "DELIVERY";

export type DeliveryProductOption = {
  id: string;
  name: string;
  sellingPrice: number;
  unit: string;
  /** Stock principal (magasin). */
  stockQuantity: number;
};

export type DeliveryOrderLine = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type DeliveryOrder = {
  id: string;
  orderNumber: number;
  status: DeliveryOrderStatus;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  note: string | null;
  totalAmount: number;
  courierId: string | null;
  courierName: string | null;
  createdAt: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: DeliveryOrderLine[];
};

export type Courier = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
};

export type CourierStockLine = {
  productId: string;
  productName: string;
  unit: string;
  /** En main (déjà remis, pas encore livré). */
  quantity: number;
  /** Réservé par ses livraisons acceptées non finalisées. */
  reserved: number;
};

export type CourierSummary = Courier & {
  /** Total remis par l'admin. */
  allocated: number;
  /** Total rendu au stock principal. */
  returned: number;
  /** Total livré aux clients. */
  delivered: number;
  /** Ce qui doit lui rester (= remis − rendu − livré). */
  inHand: number;
  deliveriesCount: number;
  inProgressCount: number;
  deliveredValue: number;
};

export type CourierMovement = {
  id: string;
  type: CourierStockMovementType;
  productName: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  orderNumber: number | null;
  note: string | null;
  createdAt: string;
};

/** Livraisons finalisées d'une journée (date locale AAAA-MM-JJ). */
export type DeliveryDailyTotal = {
  date: string;
  deliveries: number;
  value: number;
};
