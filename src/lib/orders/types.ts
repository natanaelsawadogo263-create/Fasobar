import type { OrderPaymentStatus, OrderStatus, OrderType } from "@/lib/orders/schemas";

export type OrderActionState = {
  error?: string;
  success?: string;
  orderId?: string;
};

export type CashierProduct = {
  id: string;
  name: string;
  sellingPrice: number;
  unit: string;
  imageUrl: string | null;
  departmentCode: string;
  departmentName: string;
  categoryId: string;
  categoryName: string;
  /** Quantité stock suivie ; null/absent = non suivi (ex. plats cuisine). */
  stockQuantity?: number | null;
  fractionable?: boolean;
  barcode?: string | null;
  saleUnits?: Array<{
    id: string;
    name: string;
    price: number;
    factor: number;
    allowDecimal?: boolean;
    /** Code-barres propre à ce conditionnement (ex. carton), distinct du code produit. */
    barcode?: string | null;
  }>;
};

export type CashierCategory = {
  id: string;
  name: string;
  departmentCode: string;
};

export type OrderLineItem = {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  departmentCode: string;
  departmentName: string;
  notes: string | null;
  saleUnitId?: string | null;
  saleUnitName?: string | null;
  saleUnitFactor?: number | null;
  stockQuantity?: number | null;
};

export type OrderDetail = {
  id: string;
  orderNumber: number;
  tableReference: string | null;
  customerReference: string | null;
  orderType: OrderType;
  status: OrderStatus;
  paymentStatus: string;
  barStatus: string | null;
  kitchenStatus: string | null;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdByName: string | null;
  items: OrderLineItem[];
};

export type OpenOrderListItem = {
  id: string;
  orderNumber: number;
  tableReference: string | null;
  customerReference: string | null;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  barStatus: string | null;
  kitchenStatus: string | null;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  createdByName: string | null;
  receiptId: string | null;
};

export type AdminOrderListItem = OpenOrderListItem & {
  createdById: string | null;
  departmentCodes: Array<"BAR" | "KITCHEN">;
};

export type OrderCashierOption = {
  id: string;
  fullName: string;
};

export type AdminOrdersPageData = {
  orders: AdminOrderListItem[];
  totalOrders: number;
  openCount: number;
  paidCount: number;
  cancelledCount: number;
  totalRevenue: number;
};

export type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  departmentCode: string;
  departmentName?: string;
  categoryName?: string;
  unit: string;
  saleUnitId?: string;
  stockFactor?: number;
  allowDecimal?: boolean;
  notes?: string;
  available?: boolean;
};
