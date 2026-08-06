import "server-only";

import type { BarHistoryRow, BarOrderTicket } from "@/lib/bar/constants";
import { mapMovementToBarHistoryType } from "@/lib/bar/constants";
import type { BarHistoryTypeFilter, BarPrepStatus } from "@/lib/bar/schemas";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type { OrderType } from "@/lib/orders/schemas";
import { getDepartmentIdByCode } from "@/lib/products/queries";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isMissingBarStatusError(error: { message?: string; code?: string }): boolean {
  const msg = error.message ?? "";
  return (
    msg.includes("bar_status") ||
    msg.includes("does not exist") ||
    error.code === "42703"
  );
}

type BarOrderRow = {
  id: string;
  order_number: number;
  table_reference: string | null;
  customer_reference: string | null;
  order_type: OrderType;
  status: string;
  payment_status: string;
  bar_status: BarPrepStatus | null;
  bar_status_updated_at: string | null;
  kitchen_status: string | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  order_items: Array<{
    id: string;
    product_name_snapshot: string;
    quantity: number;
    unit_price_snapshot: number;
    line_total: number;
    notes: string | null;
    department_id: string;
  }> | null;
};

/**
 * Tickets boissons pour le responsable bar :
 * détails complets de commande + articles BAR (nom, qté, prix, notes).
 */
export async function listBarDrinkOrders(
  workspace: WorkspaceContext,
): Promise<BarOrderTicket[]> {
  const supabase = await createClient();
  const barDepartmentId = await getDepartmentIdByCode(workspace, "BAR");

  if (!barDepartmentId) {
    console.error("[listBarDrinkOrders] département BAR introuvable");
    return [];
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      table_reference,
      customer_reference,
      order_type,
      status,
      payment_status,
      bar_status,
      bar_status_updated_at,
      kitchen_status,
      subtotal,
      discount_amount,
      total_amount,
      notes,
      created_at,
      profiles!orders_created_by_fkey(full_name),
      order_items (
        id,
        product_name_snapshot,
        quantity,
        unit_price_snapshot,
        line_total,
        notes,
        department_id
      )
    `,
    )
    .eq("establishment_id", workspace.establishmentId)
    .eq("organization_id", workspace.organizationId)
    .not("bar_status", "is", null)
    .neq("status", "CANCELLED")
    .neq("payment_status", "PAID")
    .order("bar_status_updated_at", { ascending: true });

  if (error || !data) {
    if (error && isMissingBarStatusError(error)) {
      console.warn("[listBarDrinkOrders] colonne bar_status absente — migration manquante");
      return [];
    }
    if (error) {
      console.error("[listBarDrinkOrders]", error.message, error.code);
    }
    return [];
  }

  return (data as BarOrderRow[]).flatMap((row) => {
    if (!row.bar_status) return [];

    const profile = readSingle(row.profiles);
    const items = (row.order_items ?? [])
      .filter((item) => item.department_id === barDepartmentId)
      .map((item) => ({
        id: item.id,
        productName: item.product_name_snapshot,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price_snapshot ?? 0),
        lineTotal: Number(item.line_total ?? 0),
        notes: item.notes,
      }))
      .filter((item) => item.productName && item.quantity > 0);

    if (items.length === 0) return [];

    return [
      {
        id: row.id,
        orderNumber: row.order_number,
        tableReference: row.table_reference,
        customerReference: row.customer_reference,
        orderType: row.order_type,
        status: row.status,
        paymentStatus: row.payment_status,
        barStatus: row.bar_status,
        barStatusUpdatedAt: row.bar_status_updated_at,
        kitchenStatus: row.kitchen_status,
        subtotal: Number(row.subtotal ?? 0),
        discountAmount: Number(row.discount_amount ?? 0),
        totalAmount: Number(row.total_amount ?? 0),
        notes: row.notes,
        createdAt: row.created_at,
        createdByName: profile?.full_name ?? null,
        items,
      },
    ];
  });
}

export async function listBarHistoryMovements(
  workspace: WorkspaceContext,
  options: {
    stockItemId?: string;
    type?: BarHistoryTypeFilter;
    from?: string;
    to?: string;
    limit?: number;
  } = {},
): Promise<BarHistoryRow[]> {
  const supabase = await createClient();
  const departmentId = await getDepartmentIdByCode(workspace, "BAR");
  if (!departmentId) return [];

  const limit = options.limit ?? 200;

  let query = supabase
    .from("stock_movements")
    .select(
      `
      id,
      type,
      quantity,
      quantity_before,
      quantity_after,
      reference,
      reason,
      created_at,
      stock_item_id,
      stock_items!inner(id, name, unit, department_id),
      profiles(full_name)
    `,
    )
    .eq("establishment_id", workspace.establishmentId)
    .eq("stock_items.department_id", departmentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.stockItemId) {
    query = query.eq("stock_item_id", options.stockItemId);
  }
  if (options.from) {
    query = query.gte("created_at", `${options.from}T00:00:00.000Z`);
  }
  if (options.to) {
    query = query.lte("created_at", `${options.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.flatMap((row) => {
    const stockItem = readSingle(
      row.stock_items as
        | { id: string; name: string; unit: string; department_id: string }
        | { id: string; name: string; unit: string; department_id: string }[]
        | null,
    );
    const profile = readSingle(
      row.profiles as { full_name: string } | { full_name: string }[] | null,
    );
    if (!stockItem) return [];

    const displayType = mapMovementToBarHistoryType(row.type);
    if (options.type && options.type !== "all" && displayType !== options.type) {
      return [];
    }

    return [
      {
        id: row.id,
        createdAt: row.created_at,
        stockItemId: row.stock_item_id as string,
        productName: stockItem.name,
        unit: stockItem.unit,
        displayType,
        quantity: Number(row.quantity),
        quantityBefore: Number(row.quantity_before),
        quantityAfter: Number(row.quantity_after),
        reason: row.reason,
        reference: row.reference,
        authorName: profile?.full_name ?? null,
      },
    ];
  });
}

export type BarDashboardData = {
  toPrepare: number;
  inPreparation: number;
  ready: number;
  lowStock: number;
  recentOrders: BarOrderTicket[];
  stockAlerts: Array<{
    id: string;
    name: string;
    currentQuantity: number;
    minimumQuantity: number;
    unit: string;
    status: "low" | "out";
  }>;
};

export async function getBarDashboardData(
  workspace: WorkspaceContext,
): Promise<BarDashboardData> {
  const { listStockItems } = await import("@/lib/stock/queries");

  const [orders, stockItems] = await Promise.all([
    listBarDrinkOrders(workspace),
    listStockItems(workspace, { tab: "bar", status: "all" }),
  ]);

  const alerts = stockItems
    .filter((item) => item.active && (item.status === "low" || item.status === "out"))
    .map((item) => ({
      id: item.id,
      name: item.name,
      currentQuantity: item.currentQuantity,
      minimumQuantity: item.minimumQuantity,
      unit: item.unit,
      status: (item.status === "out" ? "out" : "low") as "low" | "out",
    }))
    .slice(0, 8);

  return {
    toPrepare: orders.filter((o) => o.barStatus === "TO_PREPARE").length,
    inPreparation: orders.filter((o) => o.barStatus === "IN_PREPARATION").length,
    ready: orders.filter((o) => o.barStatus === "READY").length,
    lowStock: alerts.length,
    recentOrders: orders.slice(0, 6),
    stockAlerts: alerts,
  };
}
