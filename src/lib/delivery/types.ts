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
  /** Format en gros (ex. « Carton de 12 ») ; null = vendu à l'unité. */
  saleUnitName: string | null;
  /** Prix d'un exemplaire du format vendu. */
  unitPrice: number;
  /** Quantité dans le format vendu (ex. 2 cartons). */
  quantity: number;
  /** Quantité en unités de stock (ex. 24 pièces) : ce qui sort du stock du livreur. */
  stockQuantity: number;
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
  /** Coût de la course déclaré par le livreur (retenu sur l'argent du client). */
  deliveryFee: number | null;
  courierId: string | null;
  courierName: string | null;
  createdAt: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
  /** Encaissée par la caisse (vente enregistrée). Null = livrée mais pas encore encaissée. */
  cashedAt: string | null;
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
  /** Valeur des livraisons de la période (encaissées ou non). */
  deliveredValue: number;
  /** Part encaissée par la caisse : le chiffre d'affaires réel. */
  cashedValue: number;
  /** Livrées mais pas encore encaissées (état actuel, toutes dates) : argent chez le livreur. */
  toCashCount: number;
  toCashValue: number;
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
  /** Part encaissée par la caisse. */
  cashedValue: number;
};
