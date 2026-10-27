import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { listSaleOrderSurpluses } from "@/lib/profit/sale-surplus";
import { selectOrderItemsByOrderIds } from "@/lib/sales/order-items-chunked";
import { dayRangeToIso, listPaidOrdersInRange } from "@/lib/sales/paid-orders";
import type { SalesFiltersInput } from "@/lib/sales/schemas";
import type {
  AdminSalesPageData,
  SalesByCashier,
  SalesByDay,
  SalesByHour,
  SalesOrderRow,
  SalesTopProduct,
} from "@/lib/sales/types";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const EMPTY_DATA: AdminSalesPageData = {
  summary: {
    totalRevenue: 0,
    paidOrderCount: 0,
    barRevenue: 0,
    kitchenRevenue: 0,
    otherRevenue: 0,
  },
  topProducts: [],
  byCashier: [],
  byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, orderCount: 0 })),
  byDay: [],
  orders: [],
  saleSurpluses: [],
};

type OrderItemRow = {
  order_id: string;
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  line_total: number;
  department_id: string;
};

/**
 * Données de ventes Admin — exclusivement issues des commandes payées
 * (payment_status = 'PAID'), donc de paiements confirmés. Aucune donnée fictive.
 */
export async function getAdminSalesData(
  workspace: WorkspaceContext,
  filters: SalesFiltersInput = {},
): Promise<AdminSalesPageData> {
  const supabase = await createClient();

  // Datées au paiement (reçu), toutes lues : plus de plafond à 150 ventes.
  const orderRows = await listPaidOrdersInRange(supabase, workspace, {
    ...dayRangeToIso(filters.from, filters.to),
    cashierId: filters.cashierId,
  });

  if (orderRows.length === 0) {
    return EMPTY_DATA;
  }

  const orderIds = orderRows.map((row) => row.id);

  // Lecture articles : client service role si dispo (évite les trous RLS sur order_items).
  const itemsClient = isAdminClientConfigured() ? createAdminClient() : supabase;
  const { data: items } = await selectOrderItemsByOrderIds<
    OrderItemRow & {
      departments?: { code: string; name: string } | { code: string; name: string }[] | null;
    }
  >(
    itemsClient,
    workspace.establishmentId,
    orderIds,
    "order_id, product_id, product_name_snapshot, quantity, line_total, departments(code, name)",
  );

  const totalRevenue = orderRows.reduce((sum, row) => sum + row.totalAmount, 0);
  const paidOrderCount = orderRows.length;

  let barRevenue = 0;
  let kitchenRevenue = 0;
  let otherRevenue = 0;

  const productAgg = new Map<string, SalesTopProduct>();
  const itemCountByOrder = new Map<string, number>();

  for (const item of items) {
    const department = readSingle(item.departments ?? null);
    const lineTotal = Number(item.line_total) || 0;
    const quantity = Number(item.quantity) || 0;

    if (department?.code === "BAR") {
      barRevenue += lineTotal;
    } else if (department?.code === "KITCHEN") {
      kitchenRevenue += lineTotal;
    } else {
      otherRevenue += lineTotal;
    }

    itemCountByOrder.set(
      item.order_id,
      (itemCountByOrder.get(item.order_id) ?? 0) + quantity,
    );

    const existing = productAgg.get(item.product_id);
    if (existing) {
      existing.quantity += quantity;
      existing.revenue += lineTotal;
    } else {
      productAgg.set(item.product_id, {
        productId: item.product_id,
        name: item.product_name_snapshot,
        departmentCode: department?.code ?? "—",
        departmentName: department?.name ?? "—",
        quantity,
        revenue: lineTotal,
      });
    }
  }

  const topProducts = Array.from(productAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  const cashierAgg = new Map<string, SalesByCashier>();
  const hourAgg = new Map<number, SalesByHour>();
  const dayAgg = new Map<string, SalesByDay>();
  const orders: SalesOrderRow[] = [];

  for (const row of orderRows) {
    const cashierId = row.createdBy;
    const cashierName = row.cashierName ?? "—";
    const paidAt = row.paidAt;

    const cashierEntry = cashierAgg.get(cashierId);
    if (cashierEntry) {
      cashierEntry.orderCount += 1;
      cashierEntry.revenue += row.totalAmount;
    } else {
      cashierAgg.set(cashierId, {
        cashierId,
        cashierName,
        orderCount: 1,
        revenue: row.totalAmount,
      });
    }

    // Heure et jour de Ouagadougou (UTC).
    const hour = new Date(paidAt).getUTCHours();
    const hourEntry = hourAgg.get(hour);
    if (hourEntry) {
      hourEntry.revenue += row.totalAmount;
      hourEntry.orderCount += 1;
    } else {
      hourAgg.set(hour, { hour, revenue: row.totalAmount, orderCount: 1 });
    }

    const dayKey = new Date(paidAt).toISOString().slice(0, 10);
    const dayEntry = dayAgg.get(dayKey);
    if (dayEntry) {
      dayEntry.revenue += row.totalAmount;
      dayEntry.orderCount += 1;
    } else {
      dayAgg.set(dayKey, { date: dayKey, revenue: row.totalAmount, orderCount: 1 });
    }

    orders.push({
      id: row.id,
      orderNumber: row.orderNumber,
      paidAt,
      cashierName,
      itemCount: Math.round((itemCountByOrder.get(row.id) ?? 0) * 1000) / 1000,
      totalAmount: row.totalAmount,
      surplus: null,
      costAmount: null,
    });
  }

  const byCashier = Array.from(cashierAgg.values()).sort((a, b) => b.revenue - a.revenue);
  const byHour = Array.from(
    { length: 24 },
    (_, hour) => hourAgg.get(hour) ?? { hour, revenue: 0, orderCount: 0 },
  );
  const byDay = Array.from(dayAgg.values()).sort((a, b) => a.date.localeCompare(b.date));

  orders.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  const saleSurpluses = await listSaleOrderSurpluses(
    workspace.establishmentId,
    orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      paidAt: order.paidAt,
      cashierName: order.cashierName,
    })),
  );

  const surplusByOrder = new Map(
    saleSurpluses.map((sale) => [sale.orderId, sale] as const),
  );
  for (const order of orders) {
    const sale = surplusByOrder.get(order.id);
    if (!sale) continue;
    order.surplus = sale.surplus;
    order.costAmount = sale.costAmount;
  }

  return {
    summary: {
      totalRevenue,
      paidOrderCount,
      barRevenue,
      kitchenRevenue,
      otherRevenue,
    },
    topProducts,
    byCashier,
    byHour,
    byDay,
    orders,
    saleSurpluses,
  };
}
