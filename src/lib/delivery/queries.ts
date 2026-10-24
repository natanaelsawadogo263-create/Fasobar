import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type {
  Courier,
  CourierMovement,
  CourierStockLine,
  CourierStockMovementType,
  CourierSummary,
  DeliveryDailyTotal,
  DeliveryOrder,
  DeliveryOrderStatus,
  DeliveryProductOption,
} from "@/lib/delivery/types";
import { toLocalIsoDate } from "@/lib/delivery/period";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type OrderRow = {
  id: string;
  order_number: number;
  status: DeliveryOrderStatus;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  note: string | null;
  total_amount: number;
  courier_id: string | null;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  cashed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  delivery_order_items:
    | Array<{
        product_id: string;
        product_name: string;
        unit_price: number;
        quantity: number | string;
        line_total: number;
      }>
    | null;
};

const ORDER_SELECT =
  "id, order_number, status, customer_name, customer_phone, delivery_address, note, total_amount, courier_id, created_at, accepted_at, delivered_at, cashed_at, cancelled_at, cancel_reason, delivery_order_items(product_id, product_name, unit_price, quantity, line_total)";

/**
 * Noms des employés : la RLS `profiles` ne laisse lire que l'admin.
 * Les ids viennent toujours de lignes déjà filtrées sur l'établissement courant.
 */
async function loadProfileNames(userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return names;

  const client = isAdminClientConfigured() ? createAdminClient() : await createClient();
  const { data, error } = await client.from("profiles").select("id, full_name").in("id", ids);

  if (error) {
    console.error("[delivery.loadProfileNames]", error.message);
    return names;
  }

  for (const row of data ?? []) {
    names.set(row.id as string, (row.full_name as string | null)?.trim() || "Livreur");
  }
  return names;
}

function mapOrder(row: OrderRow, names: Map<string, string>): DeliveryOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryAddress: row.delivery_address,
    note: row.note,
    totalAmount: Number(row.total_amount),
    courierId: row.courier_id,
    courierName: row.courier_id ? (names.get(row.courier_id) ?? "Livreur") : null,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    deliveredAt: row.delivered_at,
    cashedAt: row.cashed_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    items: (row.delivery_order_items ?? []).map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      unitPrice: Number(item.unit_price),
      quantity: Number(item.quantity),
      lineTotal: Number(item.line_total),
    })),
  };
}

export async function listDeliveryProducts(
  workspace: WorkspaceContext,
): Promise<DeliveryProductOption[]> {
  const supabase = await createClient();

  const [productsResult, stockResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, selling_price, unit")
      .eq("establishment_id", workspace.establishmentId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("stock_items")
      .select("product_id, current_quantity")
      .eq("establishment_id", workspace.establishmentId)
      .not("product_id", "is", null),
  ]);

  if (productsResult.error) {
    console.error("[listDeliveryProducts]", productsResult.error.message);
    return [];
  }

  const stockByProduct = new Map<string, number>();
  for (const row of stockResult.data ?? []) {
    const productId = row.product_id as string;
    if (!stockByProduct.has(productId)) {
      stockByProduct.set(productId, Number(row.current_quantity));
    }
  }

  return (productsResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    sellingPrice: Number(row.selling_price),
    unit: row.unit as string,
    stockQuantity: stockByProduct.get(row.id as string) ?? 0,
  }));
}

export async function listDeliveryOrders(
  workspace: WorkspaceContext,
  options: {
    statuses?: DeliveryOrderStatus[];
    courierId?: string;
    limit?: number;
    /** Livrées à partir de cette date (ISO) — historique. */
    deliveredSince?: string;
    /** Livrées avant cette date (ISO, exclue). */
    deliveredBefore?: string;
    orderBy?: "created_at" | "delivered_at";
    /** true : encaissées seulement ; false : pas encore encaissées. */
    cashed?: boolean;
  } = {},
): Promise<DeliveryOrder[]> {
  const supabase = await createClient();

  let query = supabase
    .from("delivery_orders")
    .select(ORDER_SELECT)
    .eq("establishment_id", workspace.establishmentId)
    .order(options.orderBy ?? "created_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (options.statuses?.length) {
    query = query.in("status", options.statuses);
  }
  if (options.courierId) {
    query = query.eq("courier_id", options.courierId);
  }
  if (options.deliveredSince) {
    query = query.gte("delivered_at", options.deliveredSince);
  }
  if (options.deliveredBefore) {
    query = query.lt("delivered_at", options.deliveredBefore);
  }
  if (options.cashed === true) {
    query = query.not("cashed_at", "is", null);
  } else if (options.cashed === false) {
    query = query.is("cashed_at", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[listDeliveryOrders]", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as OrderRow[];
  const names = await loadProfileNames(
    rows.map((row) => row.courier_id).filter((id): id is string => Boolean(id)),
  );
  return rows.map((row) => mapOrder(row, names));
}

export async function listCouriers(workspace: WorkspaceContext): Promise<Courier[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("establishment_memberships")
    .select("user_id, status, profiles(full_name, phone)")
    .eq("establishment_id", workspace.establishmentId)
    .eq("role", "DELIVERY_AGENT");

  if (error) {
    console.error("[listCouriers]", error.message);
    return [];
  }

  type Row = {
    user_id: string;
    status: string;
    profiles:
      | { full_name: string | null; phone: string | null }
      | Array<{ full_name: string | null; phone: string | null }>
      | null;
  };

  return ((data ?? []) as unknown as Row[])
    .map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.user_id,
        name: profile?.full_name?.trim() || "Livreur",
        phone: profile?.phone ?? null,
        active: row.status === "ACTIVE",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function getCourierStock(
  workspace: WorkspaceContext,
  courierId: string,
): Promise<CourierStockLine[]> {
  const supabase = await createClient();

  const [stockResult, reservedOrders] = await Promise.all([
    supabase
      .from("courier_stock")
      .select("product_id, quantity, products(name, unit)")
      .eq("establishment_id", workspace.establishmentId)
      .eq("courier_id", courierId),
    listDeliveryOrders(workspace, { statuses: ["ACCEPTED"], courierId, limit: 200 }),
  ]);

  if (stockResult.error) {
    console.error("[getCourierStock]", stockResult.error.message);
    return [];
  }

  const reserved = new Map<string, number>();
  for (const order of reservedOrders) {
    for (const item of order.items) {
      reserved.set(item.productId, (reserved.get(item.productId) ?? 0) + item.quantity);
    }
  }

  type Row = {
    product_id: string;
    quantity: number | string;
    products:
      | { name: string; unit: string }
      | Array<{ name: string; unit: string }>
      | null;
  };

  return ((stockResult.data ?? []) as unknown as Row[])
    .map((row) => {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      return {
        productId: row.product_id,
        productName: product?.name ?? "Article",
        unit: product?.unit ?? "PIECE",
        quantity: Number(row.quantity),
        reserved: reserved.get(row.product_id) ?? 0,
      };
    })
    .filter((line) => line.quantity > 0 || line.reserved > 0)
    .sort((a, b) => a.productName.localeCompare(b.productName, "fr"));
}

/** Bornes d'une période d'analyse : `start` inclus, `end` exclu. */
export type PeriodBounds = { start: Date; end: Date };

const PAGE_SIZE = 1000;

/**
 * Lit toutes les lignes d'une requête, par pages de 1000 (limite PostgREST) :
 * les totaux d'une longue période ne sont jamais tronqués.
 */
async function fetchAllRows<T>(
  label: string,
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await build(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error(label, error.message);
      break;
    }
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export type CourierPeriodReport = {
  couriers: CourierSummary[];
  /** Livraisons et chiffre d'affaires par jour (jours sans livraison omis), du plus récent au plus ancien. */
  daily: DeliveryDailyTotal[];
};

/**
 * Synthèse par livreur. Avec une période : remis / livré / rendu, livraisons
 * et valeur livrée sur la période ; « doit lui rester » et « en cours »
 * restent l'état actuel. Sans période : depuis le début.
 */
export async function getCourierPeriodReport(
  workspace: WorkspaceContext,
  period: PeriodBounds | null,
  courierId?: string,
): Promise<CourierPeriodReport> {
  const supabase = await createClient();
  const startIso = period?.start.toISOString();
  const endIso = period?.end.toISOString();

  type MovementRow = { courier_id: string; type: CourierStockMovementType; quantity: number | string };
  type StockRow = { courier_id: string; quantity: number | string };
  type InProgressRow = { courier_id: string | null };
  type DeliveredRow = {
    courier_id: string | null;
    total_amount: number | string;
    delivered_at: string | null;
    cashed_at: string | null;
  };
  type ToCashRow = { courier_id: string | null; total_amount: number | string };

  const [allCouriers, movements, stockRows, inProgressRows, deliveredRows, toCashRows] = await Promise.all([
    listCouriers(workspace),
    fetchAllRows<MovementRow>("[getCourierPeriodReport:movements]", (from, to) => {
      let query = supabase
        .from("courier_stock_movements")
        .select("courier_id, type, quantity")
        .eq("establishment_id", workspace.establishmentId);
      if (courierId) query = query.eq("courier_id", courierId);
      if (startIso && endIso) query = query.gte("created_at", startIso).lt("created_at", endIso);
      return query.order("id").range(from, to);
    }),
    fetchAllRows<StockRow>("[getCourierPeriodReport:stock]", (from, to) => {
      let query = supabase
        .from("courier_stock")
        .select("courier_id, quantity")
        .eq("establishment_id", workspace.establishmentId);
      if (courierId) query = query.eq("courier_id", courierId);
      return query.order("courier_id").order("product_id").range(from, to);
    }),
    fetchAllRows<InProgressRow>("[getCourierPeriodReport:inProgress]", (from, to) => {
      let query = supabase
        .from("delivery_orders")
        .select("courier_id")
        .eq("establishment_id", workspace.establishmentId)
        .eq("status", "ACCEPTED");
      if (courierId) query = query.eq("courier_id", courierId);
      return query.order("id").range(from, to);
    }),
    fetchAllRows<DeliveredRow>("[getCourierPeriodReport:delivered]", (from, to) => {
      let query = supabase
        .from("delivery_orders")
        .select("courier_id, total_amount, delivered_at, cashed_at")
        .eq("establishment_id", workspace.establishmentId)
        .eq("status", "DELIVERED");
      if (courierId) query = query.eq("courier_id", courierId);
      if (startIso && endIso) query = query.gte("delivered_at", startIso).lt("delivered_at", endIso);
      return query.order("id").range(from, to);
    }),
    // Argent encore chez les livreurs : livrées non encaissées, toutes dates.
    fetchAllRows<ToCashRow>("[getCourierPeriodReport:toCash]", (from, to) => {
      let query = supabase
        .from("delivery_orders")
        .select("courier_id, total_amount")
        .eq("establishment_id", workspace.establishmentId)
        .eq("status", "DELIVERED")
        .is("cashed_at", null);
      if (courierId) query = query.eq("courier_id", courierId);
      return query.order("id").range(from, to);
    }),
  ]);

  const totals = new Map<string, Omit<CourierSummary, keyof Courier>>();
  const ensure = (id: string) => {
    let entry = totals.get(id);
    if (!entry) {
      entry = {
        allocated: 0,
        returned: 0,
        delivered: 0,
        inHand: 0,
        deliveriesCount: 0,
        inProgressCount: 0,
        deliveredValue: 0,
        cashedValue: 0,
        toCashCount: 0,
        toCashValue: 0,
      };
      totals.set(id, entry);
    }
    return entry;
  };

  for (const row of movements) {
    const entry = ensure(row.courier_id);
    const quantity = Math.abs(Number(row.quantity));
    if (row.type === "ALLOCATION") entry.allocated += quantity;
    else if (row.type === "RETURN") entry.returned += quantity;
    else entry.delivered += quantity;
  }

  for (const row of stockRows) {
    ensure(row.courier_id).inHand += Number(row.quantity);
  }

  for (const row of inProgressRows) {
    if (row.courier_id) ensure(row.courier_id).inProgressCount += 1;
  }

  const byDay = new Map<string, DeliveryDailyTotal>();
  for (const row of deliveredRows) {
    if (!row.courier_id) continue;
    const value = Number(row.total_amount);
    const cashed = row.cashed_at ? value : 0;
    const entry = ensure(row.courier_id);
    entry.deliveriesCount += 1;
    entry.deliveredValue += value;
    entry.cashedValue += cashed;

    if (row.delivered_at) {
      const date = toLocalIsoDate(new Date(row.delivered_at));
      const day = byDay.get(date) ?? { date, deliveries: 0, value: 0, cashedValue: 0 };
      day.deliveries += 1;
      day.value += value;
      day.cashedValue += cashed;
      byDay.set(date, day);
    }
  }

  for (const row of toCashRows) {
    if (!row.courier_id) continue;
    const entry = ensure(row.courier_id);
    entry.toCashCount += 1;
    entry.toCashValue += Number(row.total_amount);
  }

  const couriers = (courierId ? allCouriers.filter((item) => item.id === courierId) : allCouriers).map(
    (courier) => ({ ...courier, ...ensure(courier.id) }),
  );
  const daily = [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date));

  return { couriers, daily };
}

export async function listCourierSummaries(
  workspace: WorkspaceContext,
): Promise<CourierSummary[]> {
  return (await getCourierPeriodReport(workspace, null)).couriers;
}

export async function listCourierMovements(
  workspace: WorkspaceContext,
  courierId: string,
  limit = 200,
  period?: PeriodBounds,
): Promise<CourierMovement[]> {
  const supabase = await createClient();

  let query = supabase
    .from("courier_stock_movements")
    .select(
      "id, type, product_name, quantity, quantity_before, quantity_after, note, created_at, delivery_orders(order_number)",
    )
    .eq("establishment_id", workspace.establishmentId)
    .eq("courier_id", courierId);

  if (period) {
    query = query
      .gte("created_at", period.start.toISOString())
      .lt("created_at", period.end.toISOString());
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

  if (error) {
    console.error("[listCourierMovements]", error.message);
    return [];
  }

  type Row = {
    id: string;
    type: CourierStockMovementType;
    product_name: string;
    quantity: number | string;
    quantity_before: number | string;
    quantity_after: number | string;
    note: string | null;
    created_at: string;
    delivery_orders: { order_number: number } | Array<{ order_number: number }> | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => {
    const order = Array.isArray(row.delivery_orders)
      ? row.delivery_orders[0]
      : row.delivery_orders;
    return {
      id: row.id,
      type: row.type,
      productName: row.product_name,
      quantity: Number(row.quantity),
      quantityBefore: Number(row.quantity_before),
      quantityAfter: Number(row.quantity_after),
      orderNumber: order?.order_number ?? null,
      note: row.note,
      createdAt: row.created_at,
    };
  });
}
