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
import { formatProductUnitDisplay } from "@/lib/products/constants";
import {
  getCatalogFormProfile,
  shouldShowCatalogCategory,
} from "@/lib/activity/catalog";
import {
  normalizeStockKey,
  resolveCashierStockQuantity,
} from "@/lib/orders/stock-availability";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { listSaleUnitsForProducts } from "@/lib/products/packaging-queries";
import type { AdminOrderFiltersInput } from "@/lib/orders/schemas";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function loadLocalCatalogService() {
  return import("@/lib/local-domain/catalog-service");
}

function filterCashierCategories(
  categories: CashierCategory[],
  activityCode: string | null | undefined,
): CashierCategory[] {
  const catalog = getCatalogFormProfile(activityCode);
  return categories.filter((category) =>
    shouldShowCatalogCategory(category.name, catalog),
  );
}

export async function listCashierCategories(
  workspace: WorkspaceContext,
): Promise<CashierCategory[]> {
  if (isDesktopServerRuntime()) {
    const { listLocalCashierCategories } = await loadLocalCatalogService();
    const local = listLocalCashierCategories(workspace.establishmentId);
    if (local.length > 0) {
      return filterCashierCategories(local, workspace.activityCode);
    }
    // Fallback cloud si SQLite encore vide (premier démarrage sans pull).
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, departments(code)")
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("name");

  if (error || !data) {
    if (isDesktopServerRuntime()) {
      const { listLocalCashierCategories } = await loadLocalCatalogService();
      return filterCashierCategories(
        listLocalCashierCategories(workspace.establishmentId),
        workspace.activityCode,
      );
    }
    return [];
  }

  return filterCashierCategories(
    data.flatMap((row) => {
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
    }),
    workspace.activityCode,
  );
}

export async function listCashierProducts(
  workspace: WorkspaceContext,
): Promise<CashierProduct[]> {
  if (isDesktopServerRuntime()) {
    const { listLocalCashierProducts } = await loadLocalCatalogService();
    const local = listLocalCashierProducts(workspace.establishmentId);
    if (local.length > 0) {
      return attachCashierSaleUnits(workspace, local);
    }
  }

  const supabase = await createClient();
  const stockClient = isAdminClientConfigured() ? createAdminClient() : supabase;

  const stockQueryPromise = stockClient
    .from("stock_items")
    .select("product_id, name, current_quantity, active")
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .limit(800);

  const productsQueryPromise = supabase
    .from("products")
    .select(
      "id, name, selling_price, unit, stock_unit_label, fractionable, barcode, image_url, image_optimized_url, category_id, departments(code, name), categories(name)",
    )
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("name")
    .limit(500);

  const saleUnitsQueryPromise = supabase
    .from("product_unit_levels")
    .select(
      "id, product_id, name, parent_id, contains_qty, is_base, sellable, selling_price, allow_decimal, barcode",
    )
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("sort_order")
    .limit(2000);

  const [productsResult, stockResult, saleUnitsResultInitial] = await Promise.all([
    productsQueryPromise,
    stockQueryPromise,
    saleUnitsQueryPromise,
  ]);

  // Repli si la migration barcode sur product_unit_levels n'est pas encore appliquée.
  const saleUnitsResult = saleUnitsResultInitial.error?.message?.includes("barcode")
    ? await supabase
        .from("product_unit_levels")
        .select(
          "id, product_id, name, parent_id, contains_qty, is_base, sellable, selling_price, allow_decimal",
        )
        .eq("organization_id", workspace.organizationId)
        .eq("establishment_id", workspace.establishmentId)
        .order("sort_order")
        .limit(2000)
    : saleUnitsResultInitial;

  let rows: Array<Record<string, unknown>> | null =
    productsResult.data as Array<Record<string, unknown>> | null;
  let selectError = productsResult.error;

  if (
    productsResult.error?.message?.includes("image_original_url") ||
    productsResult.error?.message?.includes("image_optimized_url") ||
    productsResult.error?.message?.includes("fractionable")
  ) {
    const legacy = await supabase
      .from("products")
      .select(
        "id, name, selling_price, unit, image_url, category_id, departments(code, name), categories(name)",
      )
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId)
      .eq("active", true)
      .order("name")
      .limit(500);
    rows = (legacy.data as Array<Record<string, unknown>> | null) ?? null;
    selectError = legacy.error;
  }

  const stockRows = stockResult.data;

  if (selectError || !rows) {
    if (isDesktopServerRuntime()) {
      const { listLocalCashierProducts } = await loadLocalCatalogService();
      return attachCashierSaleUnits(
        workspace,
        listLocalCashierProducts(workspace.establishmentId),
      );
    }
    return [];
  }

  const qtyByProductId = new Map<string, number>();
  const qtyByName = new Map<string, number>();
  for (const item of stockRows ?? []) {
    const qty = item.active === false ? 0 : Number(item.current_quantity);
    if (!Number.isFinite(qty)) continue;
    const productId = item.product_id as string | null;
    if (productId) {
      const previous = qtyByProductId.get(productId);
      qtyByProductId.set(
        productId,
        previous === undefined ? qty : Math.min(previous, qty),
      );
    }
    const nameKey = normalizeStockKey(String(item.name ?? ""));
    if (nameKey) {
      const previous = qtyByName.get(nameKey);
      qtyByName.set(nameKey, previous === undefined ? qty : Math.min(previous, qty));
    }
  }

  const hasStockCatalog = (stockRows?.length ?? 0) > 0;

  const products = rows.flatMap((row) => {
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
    const stockQuantity = resolveCashierStockQuantity(
      {
        id: row.id as string,
        name,
        departmentCode: department.code,
      },
      qtyByProductId,
      qtyByName,
      hasStockCatalog,
    );

    return [
      {
        id: row.id as string,
        name,
        sellingPrice: row.selling_price as number,
        unit: formatProductUnitDisplay(
          String(row.unit ?? ""),
          typeof row.stock_unit_label === "string" ? row.stock_unit_label : null,
        ),
        imageUrl: optimized ?? original ?? legacy,
        departmentCode: department.code,
        departmentName: department.name,
        categoryId: row.category_id as string,
        categoryName: category.name,
        stockQuantity,
        fractionable: Boolean(row.fractionable),
        barcode: (row.barcode as string | null | undefined) ?? null,
      },
    ];
  });

  const saleMeta = Object.fromEntries(
    products.map((product) => [
      product.id,
      { sellingPrice: product.sellingPrice, unitLabel: product.unit },
    ]),
  );
  const saleMap = buildCashierSaleMapFromUnitRows(
    (saleUnitsResult.data ?? []) as SaleUnitLevelRow[],
    products.map((product) => product.id),
    saleMeta,
  );

  return attachSaleUnitsFromMap(products, saleMap);
}

type SaleUnitLevelRow = {
  id: string;
  product_id: string;
  name: string;
  parent_id: string | null;
  contains_qty: number | string | null;
  is_base: boolean | null;
  sellable: boolean | null;
  selling_price: number | string | null;
  allow_decimal: boolean | null;
  barcode?: string | null;
};

function buildCashierSaleMapFromUnitRows(
  rows: SaleUnitLevelRow[],
  productIds: string[],
  metaByProduct: Record<string, { sellingPrice: number; unitLabel: string }>,
): Awaited<ReturnType<typeof listSaleUnitsForProducts>> {
  const byProduct: Record<string, SaleUnitLevelRow[]> = {};
  for (const row of rows) {
    if (!byProduct[row.product_id]) byProduct[row.product_id] = [];
    byProduct[row.product_id]!.push(row);
  }

  const result: Awaited<ReturnType<typeof listSaleUnitsForProducts>> = {};
  for (const productId of productIds) {
    const meta = metaByProduct[productId];
    const levels = byProduct[productId] ?? [];
    const mapped = levels
      .filter((row) => row.sellable !== false)
      .map((row) => ({
        id: row.id,
        productId,
        name: row.name,
        packagingUnit: row.name,
        baseUnit: row.name,
        conversionFactor: Number(row.contains_qty ?? 1) || 1,
        active: true,
        sellingPrice: Number(row.selling_price ?? 0) || meta?.sellingPrice || 0,
        allowDecimal: Boolean(row.allow_decimal),
        barcode: row.barcode ?? null,
      }));

    const packs = mapped.filter((unit) => unit.conversionFactor > 1);
    let bases = mapped.filter((unit) => unit.conversionFactor <= 1);

    if (bases.length === 0 && meta && meta.sellingPrice > 0) {
      bases = [
        {
          id: "",
          productId,
          name: meta.unitLabel,
          packagingUnit: meta.unitLabel,
          baseUnit: meta.unitLabel,
          conversionFactor: 1,
          active: true,
          sellingPrice: meta.sellingPrice,
          allowDecimal: false,
          barcode: null,
        },
      ];
    }

    const preferredBase = bases.find((unit) => unit.id) ?? bases[0];
    result[productId] = preferredBase ? [preferredBase, ...packs] : packs;
  }

  return result;
}

function attachSaleUnitsFromMap(
  products: CashierProduct[],
  saleMap: Awaited<ReturnType<typeof listSaleUnitsForProducts>>,
): CashierProduct[] {
  return products.map((product) => {
    const units = saleMap[product.id] ?? [];
    const saleUnits = units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      price: unit.sellingPrice ?? 0,
      factor: unit.conversionFactor || 1,
      allowDecimal: Boolean(unit.allowDecimal),
      barcode: unit.barcode ?? null,
    }));
    return { ...product, saleUnits };
  });
}

async function attachCashierSaleUnits(
  workspace: WorkspaceContext,
  products: CashierProduct[],
): Promise<CashierProduct[]> {
  const saleMeta = Object.fromEntries(
    products.map((product) => [
      product.id,
      { sellingPrice: product.sellingPrice, unitLabel: product.unit },
    ]),
  );
  const saleMap = await listSaleUnitsForProducts(
    workspace,
    products.map((product) => product.id),
    saleMeta,
  );
  return attachSaleUnitsFromMap(products, saleMap);
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
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
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
    "id, order_number, table_reference, customer_reference, status, payment_status, bar_status, kitchen_status, total_amount, created_at, updated_at, profiles!orders_created_by_fkey(full_name), receipts(id)";

  // Ouvertes + en attente : toujours visibles tant qu'elles ne sont pas payées.
  const activeQuery = supabase
    .from("orders")
    .select(selectClause)
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .in("status", ["OPEN", "READY_TO_PAY", "DRAFT"])
    .neq("payment_status", "PAID")
    .order("created_at", { ascending: false })
    .limit(100);

  // Terminées : commandes payées de la journée de session.
  const paidQuery = includeFinalized
    ? supabase
        .from("orders")
        .select(selectClause)
        .eq("organization_id", workspace.organizationId)
        .eq("establishment_id", workspace.establishmentId)
        .eq("payment_status", "PAID")
        .neq("status", "CANCELLED")
        .gte("updated_at", dayStartIso)
        .order("updated_at", { ascending: false })
        .limit(80)
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
    const itemCount = 0;
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
  unit_level_id?: string | null;
  sale_unit_name?: string | null;
  sale_unit_factor?: number | null;
  stock_quantity?: number | null;
  departments: { code: string; name: string } | { code: string; name: string }[] | null;
};

function mapOrderItem(row: OrderItemRow): OrderLineItem {
  const department = readSingle(row.departments);

  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name_snapshot,
    unitPrice: row.unit_price_snapshot,
    quantity: Number(row.quantity),
    lineTotal: row.line_total,
    departmentCode: department?.code ?? "BAR",
    departmentName: department?.name ?? "—",
    notes: row.notes,
    saleUnitId: row.unit_level_id ?? null,
    saleUnitName: row.sale_unit_name ?? null,
    saleUnitFactor: row.sale_unit_factor ?? null,
    stockQuantity: row.stock_quantity ?? null,
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

  const orderSelectWithProfile =
    "id, order_number, table_reference, customer_reference, order_type, status, payment_status, bar_status, kitchen_status, subtotal, discount_amount, total_amount, notes, created_at, updated_at, cancelled_at, cancellation_reason, profiles!orders_created_by_fkey(full_name)";
  const orderSelectPlain =
    "id, order_number, table_reference, customer_reference, order_type, status, payment_status, bar_status, kitchen_status, subtotal, discount_amount, total_amount, notes, created_at, updated_at, cancelled_at, cancellation_reason";

  let orderResult = await supabase
    .from("orders")
    .select(orderSelectWithProfile)
    .eq("id", orderId)
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .maybeSingle();

  if (orderResult.error) {
    orderResult = await supabase
      .from("orders")
      .select(orderSelectPlain)
      .eq("id", orderId)
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .maybeSingle();
  }

  const order = orderResult.data;
  if (orderResult.error || !order) {
    return null;
  }

  const itemsSelectWithDept =
    "id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total, notes, unit_level_id, sale_unit_name, sale_unit_factor, stock_quantity, departments(code, name)";
  const itemsSelectPlain =
    "id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total, notes, unit_level_id, sale_unit_name, sale_unit_factor, stock_quantity";

  let itemsResult = await supabase
    .from("order_items")
    .select(itemsSelectWithDept)
    .eq("order_id", orderId)
    .order("created_at");

  if (itemsResult.error) {
    itemsResult = (await supabase
      .from("order_items")
      .select(itemsSelectPlain)
      .eq("order_id", orderId)
      .order("created_at")) as typeof itemsResult;
  }

  if (itemsResult.error) {
    const legacyDept =
      "id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total, notes, departments(code, name)";
    itemsResult = (await supabase
      .from("order_items")
      .select(legacyDept)
      .eq("order_id", orderId)
      .order("created_at")) as typeof itemsResult;
  }

  const items = itemsResult.data ?? [];

  const profile = readSingle(
    (order as { profiles?: { full_name: string } | { full_name: string }[] | null })
      .profiles ?? null,
  );

  const mappedItems = items.map((row) => mapOrderItem(row as OrderItemRow));

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

  // Équipe établissement (pas de scan de 500 commandes).
  const { data, error } = await supabase
    .from("establishment_memberships")
    .select("user_id, profiles(full_name)")
    .eq("establishment_id", workspace.establishmentId)
    .eq("status", "ACTIVE")
    .in("role", [
      "CASHIER_KITCHEN",
      "CASHIER",
      "ADMIN",
      "OWNER",
      "BAR_MANAGER",
    ])
    .limit(80);

  if (error || !data) {
    return [];
  }

  const byId = new Map<string, string>();

  for (const row of data) {
    const id = row.user_id as string | null;
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
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("created_at", { ascending: false })
    .limit(150);

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
