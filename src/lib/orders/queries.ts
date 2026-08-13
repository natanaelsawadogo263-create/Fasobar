import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import type {
  AdminOrderListItem,
  AdminOrdersPageData,
  CashierCategory,
  CashierProduct,
  OpenOrderListItem,
  OrderCashierOption,
  OrderDetail,
  OrderLineItem,
} from "@/lib/orders/types";
import type { AdminOrderFiltersInput } from "@/lib/orders/schemas";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function loadLocalCatalogService() {
  return import("@/lib/local-domain/catalog-service");
}

export async function listCashierCategories(
  workspace: WorkspaceContext,
): Promise<CashierCategory[]> {
  if (isDesktopServerRuntime()) {
    const { listLocalCashierCategories } = await loadLocalCatalogService();
    const local = listLocalCashierCategories(workspace.establishmentId);
    if (local.length > 0) {
      return local;
    }
    // Fallback cloud si SQLite encore vide (premier démarrage sans pull).
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, departments(code)")
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("name");

  if (error || !data) {
    if (isDesktopServerRuntime()) {
      const { listLocalCashierCategories } = await loadLocalCatalogService();
      return listLocalCashierCategories(workspace.establishmentId);
    }
    return [];
  }

  return data.flatMap((row) => {
    const department = readSingle(
      row.departments as { code: string } | { code: string }[] | null,
    );

    if (!department) {
      return [];
    }

    return [
      {
        id: row.id,
        name: row.name,
        departmentCode: department.code,
      },
    ];
  });
}

export async function listCashierProducts(
  workspace: WorkspaceContext,
): Promise<CashierProduct[]> {
  if (isDesktopServerRuntime()) {
    const { listLocalCashierProducts } = await loadLocalCatalogService();
    const local = listLocalCashierProducts(workspace.establishmentId);
    if (local.length > 0) {
      return local;
    }
  }

  const supabase = await createClient();

  const stockQuery = supabase
    .from("stock_items")
    .select("product_id, name, current_quantity")
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true);

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, selling_price, unit, image_url, image_original_url, image_optimized_url, category_id, departments(code, name), categories(name)",
    )
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("name");

  let rows: Array<Record<string, unknown>> | null = data as Array<Record<string, unknown>> | null;
  let selectError = error;

  if (
    error?.message?.includes("image_original_url") ||
    error?.message?.includes("image_optimized_url")
  ) {
    const legacy = await supabase
      .from("products")
      .select(
        "id, name, selling_price, unit, image_url, category_id, departments(code, name), categories(name)",
      )
      .eq("establishment_id", workspace.establishmentId)
      .eq("active", true)
      .order("name");
    rows = (legacy.data as Array<Record<string, unknown>> | null) ?? null;
    selectError = legacy.error;
  }

  const { data: stockRows } = await stockQuery;

  if (selectError || !rows) {
    if (isDesktopServerRuntime()) {
      const { listLocalCashierProducts } = await loadLocalCatalogService();
      return listLocalCashierProducts(workspace.establishmentId);
    }
    return [];
  }

  const qtyByProductId = new Map<string, number>();
  const qtyByName = new Map<string, number>();
  for (const item of stockRows ?? []) {
    const qty = Number(item.current_quantity);
    if (!Number.isFinite(qty)) continue;
    const productId = item.product_id as string | null;
    if (productId) {
      const previous = qtyByProductId.get(productId);
      qtyByProductId.set(
        productId,
        previous === undefined ? qty : Math.min(previous, qty),
      );
    }
    const nameKey = String(item.name ?? "")
      .trim()
      .toLowerCase();
    if (nameKey) {
      const previous = qtyByName.get(nameKey);
      qtyByName.set(nameKey, previous === undefined ? qty : Math.min(previous, qty));
    }
  }

  return rows.flatMap((row) => {
    const department = readSingle(
      row.departments as { code: string; name: string } | { code: string; name: string }[] | null,
    );
    const category = readSingle(row.categories as { name: string } | { name: string }[] | null);

    if (!department || !category) {
      return [];
    }

    const optimized = (row.image_optimized_url as string | null | undefined) ?? null;
    const original = (row.image_original_url as string | null | undefined) ?? null;
    const legacy = (row.image_url as string | null | undefined) ?? null;
    const name = row.name as string;
    const stockQuantity =
      department.code === "BAR"
        ? (qtyByProductId.get(row.id as string) ??
          qtyByName.get(name.trim().toLowerCase()) ??
          null)
        : null;

    return [
      {
        id: row.id as string,
        name,
        sellingPrice: row.selling_price as number,
        unit: row.unit as string,
        imageUrl: optimized ?? original ?? legacy,
        departmentCode: department.code,
        departmentName: department.name,
        categoryId: row.category_id as string,
        categoryName: category.name,
        stockQuantity,
      },
    ];
  });
}

export async function listOpenOrders(
  workspace: WorkspaceContext,
): Promise<OpenOrderListItem[]> {
  return listCashierOrders(workspace, { includeFinalized: false });
}

/** Compteurs shell caisse : pas de jointures ni de lignes. */
export async function countCashierOpenOrders(
  workspace: WorkspaceContext,
): Promise<{ openCount: number; readyToPayCount: number }> {
  if (isDesktopServerRuntime()) {
    const { getLocalDatabase } = await import("@/lib/local-db/database");
    const { listLocalCashierOrders } = await import(
      "@/lib/local-domain/orders-local"
    );
    const orders = listLocalCashierOrders(
      getLocalDatabase({ skipBackup: true }),
      workspace,
      { includeFinalized: false },
    );
    return {
      openCount: orders.length,
      readyToPayCount: orders.filter((order) => order.status === "READY_TO_PAY")
        .length,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("status")
    .eq("establishment_id", workspace.establishmentId)
    .in("status", ["OPEN", "READY_TO_PAY", "DRAFT"])
    .neq("payment_status", "PAID")
    .limit(200);

  if (error || !data) {
    return { openCount: 0, readyToPayCount: 0 };
  }

  return {
    openCount: data.length,
    readyToPayCount: data.filter((row) => row.status === "READY_TO_PAY").length,
  };
}

/** Début de la journée de service (fuseau Ouagadougou / UTC+0). */
export function getCashierServiceDayStartIso(referenceIso?: string): string {
  const reference = referenceIso ? new Date(referenceIso) : new Date();
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()),
  ).toISOString();
}

/**
 * Commandes caissière de la session / journée :
 * - ouvertes & en attente (non payées)
 * - terminées / payées du jour
 */
export async function listCashierOrders(
  workspace: WorkspaceContext,
  options: {
    includeFinalized?: boolean;
    /** Horodatage d'ouverture de session → borne la journée de service. */
    sessionOpenedAt?: string | null;
  } = {},
): Promise<OpenOrderListItem[]> {
  if (isDesktopServerRuntime()) {
    const { getLocalDatabase } = await import("@/lib/local-db/database");
    const { listLocalCashierOrders } = await import(
      "@/lib/local-domain/orders-local"
    );
    return listLocalCashierOrders(
      getLocalDatabase({ skipBackup: true }),
      workspace,
      options,
    );
  }

  const supabase = await createClient();
  const includeFinalized = options.includeFinalized ?? true;
  const dayStartIso = getCashierServiceDayStartIso(
    options.sessionOpenedAt ?? undefined,
  );

  const selectClause =
    "id, order_number, table_reference, customer_reference, status, payment_status, bar_status, kitchen_status, total_amount, created_at, updated_at, profiles!orders_created_by_fkey(full_name), order_items(id), receipts(id)";

  // Ouvertes + en attente : toujours visibles tant qu'elles ne sont pas payées.
  const activeQuery = supabase
    .from("orders")
    .select(selectClause)
    .eq("establishment_id", workspace.establishmentId)
    .in("status", ["OPEN", "READY_TO_PAY", "DRAFT"])
    .neq("payment_status", "PAID")
    .order("created_at", { ascending: false })
    .limit(200);

  // Terminées : commandes payées de la journée de session.
  const paidQuery = includeFinalized
    ? supabase
        .from("orders")
        .select(selectClause)
        .eq("establishment_id", workspace.establishmentId)
        .eq("payment_status", "PAID")
        .neq("status", "CANCELLED")
        .gte("updated_at", dayStartIso)
        .order("updated_at", { ascending: false })
        .limit(200)
    : null;

  const [activeResult, paidResult] = await Promise.all([
    activeQuery,
    paidQuery ?? Promise.resolve({ data: [] as never[], error: null }),
  ]);

  if (activeResult.error && (!paidResult || paidResult.error)) {
    return [];
  }

  const rows = [...(activeResult.data ?? []), ...(paidResult?.data ?? [])];
  const seen = new Set<string>();

  const mapped = rows.flatMap((row) => {
    if (seen.has(row.id)) {
      return [];
    }
    seen.add(row.id);

    const profile = readSingle(
      row.profiles as { full_name: string } | { full_name: string }[] | null,
    );
    const orderItems = row.order_items;
    const itemCount = Array.isArray(orderItems) ? orderItems.length : orderItems ? 1 : 0;
    const receipt = readSingle(
      row.receipts as { id: string } | { id: string }[] | null,
    );

    return [
      {
        id: row.id,
        orderNumber: row.order_number,
        tableReference: row.table_reference,
        customerReference: row.customer_reference,
        status: row.status,
        paymentStatus: row.payment_status,
        barStatus: row.bar_status ?? null,
        kitchenStatus: row.kitchen_status ?? null,
        totalAmount: row.total_amount,
        itemCount,
        createdAt: row.created_at,
        createdByName: profile?.full_name ?? null,
        receiptId: receipt?.id ?? null,
      } satisfies OpenOrderListItem,
    ];
  });

  mapped.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return mapped;
}

type OrderItemRow = {
  id: string;
  product_id: string;
  product_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
  notes: string | null;
  departments: { code: string; name: string } | { code: string; name: string }[] | null;
};

function mapOrderItem(row: OrderItemRow): OrderLineItem | null {
  const department = readSingle(row.departments);

  if (!department) {
    return null;
  }

  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name_snapshot,
    unitPrice: row.unit_price_snapshot,
    quantity: Number(row.quantity),
    lineTotal: row.line_total,
    departmentCode: department.code,
    departmentName: department.name,
    notes: row.notes,
  };
}

export async function getOrderById(
  workspace: WorkspaceContext,
  orderId: string,
): Promise<OrderDetail | null> {
  if (isDesktopServerRuntime()) {
    const { getLocalDatabase } = await import("@/lib/local-db/database");
    const { getLocalOrderById } = await import("@/lib/local-domain/orders-local");
    return getLocalOrderById(
      getLocalDatabase({ skipBackup: true }),
      workspace,
      orderId,
    );
  }

  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, order_number, table_reference, customer_reference, order_type, status, payment_status, bar_status, kitchen_status, subtotal, discount_amount, total_amount, notes, created_at, updated_at, cancelled_at, cancellation_reason, profiles!orders_created_by_fkey(full_name)",
    )
    .eq("id", orderId)
    .eq("establishment_id", workspace.establishmentId)
    .maybeSingle();

  if (orderError || !order) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select(
      "id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total, notes, departments(code, name)",
    )
    .eq("order_id", orderId)
    .order("created_at");

  if (itemsError || !items) {
    return null;
  }

  const profile = readSingle(
    order.profiles as { full_name: string } | { full_name: string }[] | null,
  );

  const mappedItems = items
    .map((row) => mapOrderItem(row as OrderItemRow))
    .filter((item): item is OrderLineItem => item !== null);

  return {
    id: order.id,
    orderNumber: order.order_number,
    tableReference: order.table_reference,
    customerReference: order.customer_reference,
    orderType: order.order_type,
    status: order.status,
    paymentStatus: order.payment_status,
    barStatus: order.bar_status ?? null,
    kitchenStatus: order.kitchen_status ?? null,
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    totalAmount: order.total_amount,
    notes: order.notes,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    cancelledAt: order.cancelled_at,
    cancellationReason: order.cancellation_reason,
    createdByName: profile?.full_name ?? null,
    items: mappedItems,
  };
}

export async function listOrderCashiers(
  workspace: WorkspaceContext,
): Promise<OrderCashierOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("created_by, profiles!orders_created_by_fkey(full_name)")
    .eq("establishment_id", workspace.establishmentId)
    .eq("organization_id", workspace.organizationId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !data) {
    return [];
  }

  const byId = new Map<string, string>();

  for (const row of data) {
    const id = row.created_by as string | null;
    if (!id || byId.has(id)) continue;
    const profile = readSingle(
      row.profiles as { full_name: string } | { full_name: string }[] | null,
    );
    byId.set(id, profile?.full_name ?? "Caissier");
  }

  return Array.from(byId.entries())
    .map(([id, fullName]) => ({ id, fullName }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));
}

export async function listAdminOrders(
  workspace: WorkspaceContext,
  filters: AdminOrderFiltersInput,
): Promise<AdminOrdersPageData> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, table_reference, customer_reference, status, payment_status, bar_status, kitchen_status, total_amount, created_at, created_by, profiles!orders_created_by_fkey(full_name), order_items(id, departments(code)), receipts(id)",
    )
    .eq("establishment_id", workspace.establishmentId)
    .eq("organization_id", workspace.organizationId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (filters.cashierId) {
    query = query.eq("created_by", filters.cashierId);
  }

  if (filters.from) {
    query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
  }

  if (filters.to) {
    query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;

  if (error || !data) {
    return {
      orders: [],
      totalOrders: 0,
      openCount: 0,
      paidCount: 0,
      cancelledCount: 0,
      totalRevenue: 0,
    };
  }

  let orders: AdminOrderListItem[] = data.map((row) => {
    const profile = readSingle(
      row.profiles as { full_name: string } | { full_name: string }[] | null,
    );
    const receipt = readSingle(
      row.receipts as { id: string } | { id: string }[] | null,
    );
    const items = Array.isArray(row.order_items) ? row.order_items : [];
    const departmentCodes = Array.from(
      new Set(
        items.flatMap((item) => {
          const department = readSingle(
            (item as { departments?: { code: string } | { code: string }[] | null })
              .departments ?? null,
          );
          if (department?.code === "BAR" || department?.code === "KITCHEN") {
            return [department.code];
          }
          return [];
        }),
      ),
    ) as Array<"BAR" | "KITCHEN">;

    return {
      id: row.id,
      orderNumber: row.order_number,
      tableReference: row.table_reference,
      customerReference: row.customer_reference,
      status: row.status,
      paymentStatus: row.payment_status,
      barStatus: row.bar_status ?? null,
      kitchenStatus: row.kitchen_status ?? null,
      totalAmount: row.total_amount,
      itemCount: items.length,
      createdAt: row.created_at,
      createdByName: profile?.full_name ?? null,
      createdById: row.created_by ?? null,
      receiptId: receipt?.id ?? null,
      departmentCodes,
    };
  });

  if (filters.status === "open") {
    orders = orders.filter(
      (order) => order.status !== "CANCELLED" && order.paymentStatus !== "PAID",
    );
  } else if (filters.status === "paid") {
    orders = orders.filter((order) => order.paymentStatus === "PAID");
  } else if (filters.status === "cancelled") {
    orders = orders.filter((order) => order.status === "CANCELLED");
  }

  if (filters.department === "BAR" || filters.department === "KITCHEN") {
    orders = orders.filter((order) =>
      order.departmentCodes.includes(filters.department as "BAR" | "KITCHEN"),
    );
  }

  if (filters.search?.trim()) {
    const raw = filters.search.trim().toLowerCase();
    const bare = raw.replace(/^#/, "").trim();
    const asOrderNumber =
      /^\d+$/.test(bare) && Number.isFinite(Number(bare))
        ? Number(bare)
        : null;

    orders = orders.filter((order) => {
      if (asOrderNumber !== null && order.orderNumber === asOrderNumber) {
        return true;
      }

      const padded = String(order.orderNumber).padStart(4, "0");
      const labeled = `#${padded}`;
      const haystack = [
        String(order.orderNumber),
        padded,
        labeled,
        order.tableReference ?? "",
        order.customerReference ?? "",
        order.createdByName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(raw) || (bare.length > 0 && haystack.includes(bare));
    });
  }

  const openCount = orders.filter(
    (order) => order.status !== "CANCELLED" && order.paymentStatus !== "PAID",
  ).length;
  const paidOrders = orders.filter((order) => order.paymentStatus === "PAID");
  const cancelledCount = orders.filter((order) => order.status === "CANCELLED").length;

  return {
    orders,
    totalOrders: orders.length,
    openCount,
    paidCount: paidOrders.length,
    cancelledCount,
    totalRevenue: paidOrders.reduce((sum, order) => sum + order.totalAmount, 0),
  };
}
