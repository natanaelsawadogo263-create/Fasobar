export type SalesSummary = {
  totalRevenue: number;
  paidOrderCount: number;
  barRevenue: number;
  kitchenRevenue: number;
  otherRevenue: number;
};

export type SalesTopProduct = {
  productId: string;
  name: string;
  departmentCode: string;
  departmentName: string;
  quantity: number;
  revenue: number;
};

export type SalesByCashier = {
  cashierId: string;
  cashierName: string;
  orderCount: number;
  revenue: number;
};

export type SalesByHour = {
  hour: number;
  revenue: number;
  orderCount: number;
};

export type SalesByDay = {
  date: string;
  revenue: number;
  orderCount: number;
};

export type SalesOrderRow = {
  id: string;
  orderNumber: number;
  paidAt: string;
  cashierName: string | null;
  itemCount: number;
  totalAmount: number;
};

export type AdminSalesPageData = {
  summary: SalesSummary;
  topProducts: SalesTopProduct[];
  byCashier: SalesByCashier[];
  byHour: SalesByHour[];
  byDay: SalesByDay[];
  orders: SalesOrderRow[];
};
