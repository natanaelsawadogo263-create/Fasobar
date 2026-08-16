import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
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
    averageBasket: 0,
    barRevenue: 0,
    kitchenRevenue: 0,
    otherRevenue: 0,
  },
  topProducts: [],
  byCashier: [],
  byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, orderCount: 0 })),
  byDay: [],
  orders: [],
};

type PaidOrderRow = {
  id: string;
  order_number: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
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

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, total_amount, created_at, updated_at, created_by, profiles!orders_created_by_fkey(full_name)",
    )
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .eq("organization_id", workspace.organizationId)
    .eq("payment_status", "PAID")
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (filters.cashierId) {
    query = query.eq("created_by", filters.cashierId);
  }

  if (filters.from) {
    query = query.gte("updated_at", `${filters.from}T00:00:00.000Z`);
  }

  if (filters.to) {
    query = query.lte("updated_at", `${filters.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;

  if (error || !data) {
    return EMPTY_DATA;
  }

  const orderRows = data as unknown as PaidOrderRow[];

  if (orderRows.length === 0) {
    return EMPTY_DATA;
  }

  const orderIds = orderRows.map((row) => row.id);

  // Lecture articles : client service role si dispo (évite les trous RLS sur order_items).
  const itemsClient = isAdminClientConfigured() ? createAdminClient() : supabase;
  const { data: itemRows } = await itemsClient
    .from("order_items")
    .select(
      "order_id, product_id, product_name_snapshot, quantity, line_total, department_id",
    )
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .in("order_id", orderIds);

  const items = (itemRows ?? []) as OrderItemRow[];

  const departmentIds = [...new Set(items.map((item) => item.department_id).filter(Boolean))];
  const departmentById = new Map<string, { code: string; name: string }>();

  if (departmentIds.length > 0) {
    const { data: departments } = await itemsClient
      .from("departments")
      .select("id, code, name")
      .in("id", departmentIds);

    for (const department of departments ?? []) {
      departmentById.set(department.id, {
        code: department.code,
        name: department.name,
      });
    }
  }

  const totalRevenue = orderRows.reduce((sum, row) => sum + row.total_amount, 0);
  const paidOrderCount = orderRows.length;
  const averageBasket = paidOrderCount > 0 ? Math.round(totalRevenue / paidOrderCount) : 0;

  let barRevenue = 0;
  let kitchenRevenue = 0;
  let otherRevenue = 0;

  const productAgg = new Map<string, SalesTopProduct>();
  const itemCountByOrder = new Map<string, number>();

  for (const item of items) {
    const department = departmentById.get(item.department_id);
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
    const profile = readSingle(row.profiles);
    const cashierId = row.created_by;
    const cashierName = profile?.full_name ?? "—";
    const paidAt = row.updated_at ?? row.created_at;

    const cashierEntry = cashierAgg.get(cashierId);
    if (cashierEntry) {
      cashierEntry.orderCount += 1;
      cashierEntry.revenue += row.total_amount;
    } else {
      cashierAgg.set(cashierId, {
        cashierId,
        cashierName,
        orderCount: 1,
        revenue: row.total_amount,
      });
    }

    const hour = new Date(paidAt).getUTCHours();
    const hourEntry = hourAgg.get(hour);
    if (hourEntry) {
      hourEntry.revenue += row.total_amount;
      hourEntry.orderCount += 1;
    } else {
      hourAgg.set(hour, { hour, revenue: row.total_amount, orderCount: 1 });
    }

    const dayKey = paidAt.slice(0, 10);
    const dayEntry = dayAgg.get(dayKey);
    if (dayEntry) {
      dayEntry.revenue += row.total_amount;
      dayEntry.orderCount += 1;
    } else {
      dayAgg.set(dayKey, { date: dayKey, revenue: row.total_amount, orderCount: 1 });
    }

    orders.push({
      id: row.id,
      orderNumber: row.order_number,
      paidAt,
      cashierName,
      itemCount: Math.round((itemCountByOrder.get(row.id) ?? 0) * 1000) / 1000,
      totalAmount: row.total_amount,
    });
  }

  const byCashier = Array.from(cashierAgg.values()).sort((a, b) => b.revenue - a.revenue);
  const byHour = Array.from(
    { length: 24 },
    (_, hour) => hourAgg.get(hour) ?? { hour, revenue: 0, orderCount: 0 },
  );
  const byDay = Array.from(dayAgg.values()).sort((a, b) => a.date.localeCompare(b.date));

  orders.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  return {
    summary: {
      totalRevenue,
      paidOrderCount,
      averageBasket,
      barRevenue,
      kitchenRevenue,
      otherRevenue,
    },
    topProducts,
    byCashier,
    byHour,
    byDay,
    orders,
  };
}
