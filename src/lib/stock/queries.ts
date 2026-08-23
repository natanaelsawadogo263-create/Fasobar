import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { getDepartmentIdByCode } from "@/lib/products/queries";
import { computeStockStatus } from "@/lib/stock/constants";
import type { StockFiltersInput } from "@/lib/stock/schemas";
import type {
  InventorySessionItem,
  RecentSupplyEntry,
  StockListItem,
  StockLossEntry,
  StockMovementItem,
  StockProductOption,
  StockStats,
  SupplierOption,
  SupplyReceiptDetail,
  SupplyReceiptListItem,
} from "@/lib/stock/types";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type StockItemRow = {
  id: string;
  name: string;
  unit: string;
  current_quantity: number;
  minimum_quantity: number;
  active: boolean;
  product_id: string | null;
  department_id: string;
  departments: { code: string; name: string } | { code: string; name: string }[] | null;
  products:
    | {
        category_id: string;
        stock_unit_label?: string | null;
        barcode?: string | null;
        categories: { name: string } | { name: string }[] | null;
      }
    | {
        category_id: string;
        stock_unit_label?: string | null;
        barcode?: string | null;
        categories: { name: string } | { name: string }[] | null;
      }[]
    | null;
};

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapStockItem(row: StockItemRow): StockListItem | null {
  const department = readSingle(row.departments);
  const product = readSingle(row.products);
  const category = product ? readSingle(product.categories) : null;

  if (!department) {
    return null;
  }

  const currentQuantity = Number(row.current_quantity);
  const minimumQuantity = Number(row.minimum_quantity);

  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    stockUnitLabel: product?.stock_unit_label ?? null,
    currentQuantity,
    minimumQuantity,
    active: row.active,
    departmentCode: department.code,
    departmentName: department.name,
    departmentId: row.department_id,
    productId: row.product_id,
    categoryId: product?.category_id ?? null,
    categoryName: category?.name ?? null,
    status: computeStockStatus(currentQuantity, minimumQuantity, row.active),
    estimatedUnitCost: null,
    barcode: product?.barcode ?? null,
  };
}

function matchesStatusFilter(
  item: StockListItem,
  status: StockFiltersInput["status"],
): boolean {
  if (status === "all") {
    return true;
  }

  return item.status === status;
}

export async function listStockItems(
  workspace: WorkspaceContext,
  filters: StockFiltersInput,
): Promise<StockListItem[]> {
  // Lecture fiable pour admin/manager : évite les faux vides RLS sur stock_items
  const supabase =
    workspace.canManageStock && isAdminClientConfigured()
      ? createAdminClient()
      : await createClient();

  let query = supabase
    .from("stock_items")
    .select(
      "id, name, unit, current_quantity, minimum_quantity, active, product_id, department_id, departments(code, name), products(category_id, stock_unit_label, barcode, categories(name))",
    )
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("name")
    .limit(500);

  if (filters.tab === "bar" || filters.tab === "kitchen") {
    const departmentCode = filters.tab === "bar" ? "BAR" : "KITCHEN";
    const departmentId = await getDepartmentIdByCode(workspace, departmentCode);

    if (!departmentId) {
      return [];
    }

    query = query.eq("department_id", departmentId);
  }

  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data, error } = await query;

  let rows = data;
  let queryError = error;

  if (error?.message?.includes("stock_unit_label")) {
    let fallback = supabase
      .from("stock_items")
      .select(
        "id, name, unit, current_quantity, minimum_quantity, active, product_id, department_id, departments(code, name), products(category_id, categories(name))",
      )
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId)
      .order("name")
      .limit(500);
    if (filters.tab === "bar" || filters.tab === "kitchen") {
      const departmentCode = filters.tab === "bar" ? "BAR" : "KITCHEN";
      const departmentId = await getDepartmentIdByCode(workspace, departmentCode);
      if (departmentId) fallback = fallback.eq("department_id", departmentId);
    }
    if (filters.search) {
      fallback = fallback.ilike("name", `%${filters.search}%`);
    }
    const retry = await fallback;
    rows = retry.data as typeof data;
    queryError = retry.error;
  }

  if (queryError || !rows) {
    if (queryError) {
      console.error("[listStockItems]", queryError.message);
    }
    return [];
  }

  const items = rows
    .map((row) => mapStockItem(row as StockItemRow))
    .filter((item): item is StockListItem => item !== null);

  // Déduplique par product_id (garde la meilleure quantité) pour l'affichage entrée
  const byProduct = new Map<string, StockListItem>();
  const withoutProduct: StockListItem[] = [];
  for (const item of items) {
    if (!item.productId) {
      withoutProduct.push(item);
      continue;
    }
    const previous = byProduct.get(item.productId);
    if (!previous || item.currentQuantity > previous.currentQuantity) {
      byProduct.set(item.productId, item);
    }
  }
  const deduped = [...byProduct.values(), ...withoutProduct].sort((a, b) =>
    a.name.localeCompare(b.name, "fr"),
  );

  const enriched = await attachEstimatedCosts(workspace, deduped);

  return enriched.filter((item) => {
    if (filters.tab === "alerts" && item.status !== "low" && item.status !== "out") {
      return false;
    }

    if (filters.categoryId && item.categoryId !== filters.categoryId) {
      return false;
    }

    return matchesStatusFilter(item, filters.status);
  });
}

/**
 * Alertes stock légères pour le tableau de bord :
 * pas d’enrichissement coûts, lecture ciblée.
 */
export async function listDashboardStockAlerts(
  workspace: WorkspaceContext,
  limit = 5,
): Promise<{ alerts: StockListItem[]; alertCount: number }> {
  const supabase =
    workspace.canManageStock && isAdminClientConfigured()
      ? createAdminClient()
      : await createClient();

  const { data, error } = await supabase
    .from("stock_items")
    .select(
      "id, name, unit, current_quantity, minimum_quantity, active, product_id, department_id, departments(code, name), products(category_id, stock_unit_label, categories(name))",
    )
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("current_quantity", { ascending: true })
    .limit(200);

  if (error || !data) {
    if (error) {
      console.error("[listDashboardStockAlerts]", error.message);
    }
    return { alerts: [], alertCount: 0 };
  }

  const alerts = data
    .map((row) => mapStockItem(row as StockItemRow))
    .filter((item): item is StockListItem => item !== null)
    .filter((item) => item.status === "low" || item.status === "out");

  return {
    alerts: alerts.slice(0, limit),
    alertCount: alerts.length,
  };
}

async function attachEstimatedCosts(
  workspace: WorkspaceContext,
  items: StockListItem[],
): Promise<StockListItem[]> {
  if (items.length === 0) {
    return items;
  }

  const supabase = await createClient();
  const itemIds = items.map((item) => item.id);

  // Derniers mouvements avec coût seulement (évite de charger tout l'historique).
  const { data, error } = await supabase
    .from("stock_movements")
    .select("stock_item_id, unit_cost, created_at")
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .in("stock_item_id", itemIds)
    .not("unit_cost", "is", null)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(itemIds.length * 3, 60), 400));

  if (error || !data) {
    return items;
  }

  const costByItem = new Map<string, number>();

  for (const row of data) {
    if (!costByItem.has(row.stock_item_id) && row.unit_cost !== null) {
      costByItem.set(row.stock_item_id, row.unit_cost);
    }
  }

  return items.map((item) => ({
    ...item,
    estimatedUnitCost: costByItem.get(item.id) ?? null,
  }));
}

export async function getStockStats(
  workspace: WorkspaceContext,
  items?: StockListItem[],
): Promise<StockStats> {
  const stockItems = items ?? (await listStockItems(workspace, { tab: "all", status: "all" }));

  const barItemCount = stockItems.filter((item) => item.departmentCode === "BAR").length;
  const kitchenItemCount = stockItems.filter(
    (item) => item.departmentCode === "KITCHEN",
  ).length;
  const alertCount = stockItems.filter(
    (item) => item.status === "low" || item.status === "out",
  ).length;
  const estimatedValue = stockItems.reduce((total, item) => {
    if (item.estimatedUnitCost === null) {
      return total;
    }

    return total + item.estimatedUnitCost * item.currentQuantity;
  }, 0);

  return {
    barItemCount,
    kitchenItemCount,
    alertCount,
    estimatedValue,
  };
}

export async function listSuppliers(
  workspace: WorkspaceContext,
  options: { departmentCode?: "BAR" | "KITCHEN" } = {},
): Promise<SupplierOption[]> {
  const supabase =
    workspace.canManageStock && isAdminClientConfigured()
      ? createAdminClient()
      : await createClient();

  let query = supabase
    .from("suppliers")
    .select("id, name, phone, address, active, department_code")
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .order("name");

  if (options.departmentCode) {
    query = query.eq("department_code", options.departmentCode);
  }

  let { data, error } = await query;

  // Compat: migration department_code non appliquée
  if (error && (error.message ?? "").toLowerCase().includes("department_code")) {
    const fallback = await supabase
      .from("suppliers")
      .select("id, name, phone, address, active")
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .order("name");
    data = fallback.data?.map((row) => ({ ...row, department_code: "BAR" })) ?? null;
    error = fallback.error;
  }

  if (error || !data) {
    if (error) {
      console.error("[listSuppliers]", error.message);
    }
    return [];
  }

  const mapped = data.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    active: row.active,
    departmentCode: (row.department_code === "KITCHEN" ? "KITCHEN" : "BAR") as
      | "BAR"
      | "KITCHEN",
  }));

  if (options.departmentCode) {
    return mapped.filter((row) => row.departmentCode === options.departmentCode);
  }

  return mapped;
}

export async function listStockMovements(
  workspace: WorkspaceContext,
  stockItemId: string,
): Promise<StockMovementItem[]> {
  const supabase = await createClient();

  const { data: stockItem, error: stockError } = await supabase
    .from("stock_items")
    .select("id")
    .eq("id", stockItemId)
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .maybeSingle();

  if (stockError || !stockItem) {
    return [];
  }

  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      "id, type, quantity, quantity_before, quantity_after, unit_cost, total_cost, reference, reason, created_at, profiles(full_name)",
    )
    .eq("stock_item_id", stockItemId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const profile = readSingle(
      row.profiles as { full_name: string } | { full_name: string }[] | null,
    );

    return {
      id: row.id,
      type: row.type,
      quantity: Number(row.quantity),
      quantityBefore: Number(row.quantity_before),
      quantityAfter: Number(row.quantity_after),
      unitCost: row.unit_cost,
      totalCost: row.total_cost,
      reference: row.reference,
      reason: row.reason,
      createdAt: row.created_at,
      createdByName: profile?.full_name ?? null,
    };
  });
}

export async function listRecentSupplyEntries(
  workspace: WorkspaceContext,
  options: {
    departmentCode?: "BAR" | "KITCHEN";
    from?: string;
    to?: string;
    limit?: number;
  } = {},
): Promise<RecentSupplyEntry[]> {
  const supabase = await createClient();
  const limit = options.limit ?? 40;

  let query = supabase
    .from("stock_movements")
    .select(
      "id, quantity, total_cost, reference, created_at, stock_items(name, unit, departments(code, name)), suppliers(name)",
    )
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .eq("type", "PURCHASE")
    .order("created_at", { ascending: false })
    .limit(Math.max(limit, 40));

  if (options.from) {
    query = query.gte("created_at", `${options.from}T00:00:00.000Z`);
  }

  if (options.to) {
    query = query.lte("created_at", `${options.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data
    .flatMap((row) => {
      const stockItem = readSingle(
        row.stock_items as
          | {
              name: string;
              unit: string;
              departments:
                | { code: string; name: string }
                | { code: string; name: string }[]
                | null;
            }
          | {
              name: string;
              unit: string;
              departments:
                | { code: string; name: string }
                | { code: string; name: string }[]
                | null;
            }[]
          | null,
      );
      const supplier = readSingle(
        row.suppliers as { name: string } | { name: string }[] | null,
      );
      const department = stockItem ? readSingle(stockItem.departments) : null;

      if (!stockItem || !department) {
        return [];
      }

      if (options.departmentCode && department.code !== options.departmentCode) {
        return [];
      }

      return [
        {
          id: row.id,
          stockItemName: stockItem.name,
          departmentName: department.name,
          departmentCode: department.code,
          quantity: Number(row.quantity),
          unit: stockItem.unit,
          totalCost: row.total_cost,
          reference: row.reference,
          supplierName: supplier?.name ?? null,
          createdAt: row.created_at,
        },
      ];
    })
    .slice(0, limit);
}

export async function listSupplyReceipts(
  workspace: WorkspaceContext,
  options: { from?: string; to?: string; limit?: number } = {},
): Promise<SupplyReceiptListItem[] | null> {
  const supabase = await createClient();
  const limit = options.limit ?? 80;

  let query = supabase
    .from("supply_receipts")
    .select(
      "id, received_on, status, notes, total_amount, created_at, suppliers(name), supply_receipt_lines(id, stock_items(departments(code)))",
    )
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .order("received_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.from) query = query.gte("received_on", options.from);
  if (options.to) query = query.lte("received_on", options.to);

  const { data, error } = await query;
  if (error || !data) return null;

  return data.map((row) => {
    const supplier = readSingle(row.suppliers as { name: string } | { name: string }[] | null);
    const lines =
      (row.supply_receipt_lines as
        | Array<{
            id: string;
            stock_items:
              | { departments: { code: string } | { code: string }[] | null }
              | Array<{ departments: { code: string } | { code: string }[] | null }>
              | null;
          }>
        | null) ?? [];
    const departmentCodes = [
      ...new Set(
        lines
          .map((line) => {
            const stockItem = readSingle(line.stock_items);
            const department = readSingle(stockItem?.departments ?? null);
            return department?.code;
          })
          .filter((code): code is "BAR" | "KITCHEN" => code === "BAR" || code === "KITCHEN"),
      ),
    ];
    return {
      id: row.id as string,
      supplierName: supplier?.name ?? "Fournisseur",
      receivedOn: row.received_on as string,
      status: row.status as "DRAFT" | "VALIDATED",
      notes: (row.notes as string | null) ?? null,
      totalAmount: Number(row.total_amount ?? 0),
      lineCount: lines.length,
      departmentCodes,
      createdAt: row.created_at as string,
    };
  });
}

export async function getSupplyReceiptById(
  workspace: WorkspaceContext,
  receiptId: string,
): Promise<SupplyReceiptDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supply_receipts")
    .select(
      "id, supplier_id, received_on, notes, status, suppliers(name), supply_receipt_lines(stock_item_id, product_id, unit_level_id, unit_name, purchased_quantity, conversion_factor, stock_quantity, purchase_price, line_total, sort_order, stock_items(name, unit))",
    )
    .eq("id", receiptId)
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .maybeSingle();

  if (error || !data) return null;

  const supplier = readSingle(data.suppliers as { name: string } | { name: string }[] | null);
  const lines = (
    (data.supply_receipt_lines as
      | Array<{
          stock_item_id: string;
          product_id: string | null;
          unit_level_id: string | null;
          unit_name: string;
          purchased_quantity: number;
          conversion_factor: number;
          stock_quantity: number;
          purchase_price: number;
          line_total: number;
          sort_order: number;
          stock_items:
            | { name: string; unit: string }
            | Array<{ name: string; unit: string }>
            | null;
        }>
      | null) ?? []
  ).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return {
    id: data.id as string,
    supplierId: data.supplier_id as string,
    supplierName: supplier?.name ?? "Fournisseur",
    receivedOn: data.received_on as string,
    notes: (data.notes as string | null) ?? null,
    status: data.status as "DRAFT" | "VALIDATED",
    lines: lines.map((line) => {
      const stockItem = readSingle(line.stock_items);
      return {
        stockItemId: line.stock_item_id,
        productId: line.product_id,
        productName: stockItem?.name ?? "Produit",
        stockUnit: stockItem?.unit ?? "unité",
        unitLevelId: line.unit_level_id,
        unitName: line.unit_name,
        purchasedQuantity: Number(line.purchased_quantity),
        conversionFactor: Number(line.conversion_factor),
        stockQuantity: Number(line.stock_quantity),
        purchasePrice: Number(line.purchase_price),
        lineTotal: Number(line.line_total),
      };
    }),
  };
}

export async function listStockLossEntries(
  workspace: WorkspaceContext,
  options: { from?: string; to?: string; limit?: number } = {},
): Promise<StockLossEntry[]> {
  const supabase = await createClient();
  const limit = options.limit ?? 200;

  let query = supabase
    .from("stock_movements")
    .select(
      "id, type, quantity, reason, created_at, stock_items(name, unit, departments(name)), profiles!stock_movements_created_by_fkey(full_name)",
    )
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .in("type", ["LOSS", "BREAKAGE", "STAFF_CONSUMPTION", "GIFT"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.from) {
    query = query.gte("created_at", `${options.from}T00:00:00.000Z`);
  }

  if (options.to) {
    query = query.lte("created_at", `${options.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.flatMap((row) => {
    const stockItem = readSingle(
      row.stock_items as
        | {
            name: string;
            unit: string;
            departments: { name: string } | { name: string }[] | null;
          }
        | {
            name: string;
            unit: string;
            departments: { name: string } | { name: string }[] | null;
          }[]
        | null,
    );
    const department = stockItem ? readSingle(stockItem.departments) : null;
    const profile = readSingle(
      row.profiles as { full_name: string } | { full_name: string }[] | null,
    );

    if (!stockItem || !department) {
      return [];
    }

    return [
      {
        id: row.id,
        type: row.type,
        stockItemName: stockItem.name,
        departmentName: department.name,
        quantity: Math.abs(Number(row.quantity)),
        unit: stockItem.unit,
        reason: row.reason,
        createdAt: row.created_at,
        createdByName: profile?.full_name ?? null,
      },
    ];
  });
}

export async function listInventorySessions(
  workspace: WorkspaceContext,
): Promise<InventorySessionItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inventory_sessions")
    .select(
      "id, status, started_at, completed_at, departments(code, name), profiles!inventory_sessions_started_by_fkey(full_name)",
    )
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .order("started_at", { ascending: false })
    .limit(30);

  if (error || !data) {
    return [];
  }

  return data.flatMap((row) => {
    const department = readSingle(
      row.departments as { code: string; name: string } | { code: string; name: string }[] | null,
    );
    const profile = readSingle(
      row.profiles as { full_name: string } | { full_name: string }[] | null,
    );

    if (!department) {
      return [];
    }

    return [
      {
        id: row.id,
        status: row.status,
        departmentCode: department.code,
        departmentName: department.name,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        startedByName: profile?.full_name ?? null,
        lineCount: 0,
      },
    ];
  });
}

export async function getStockItemById(
  workspace: WorkspaceContext,
  stockItemId: string,
): Promise<StockListItem | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stock_items")
    .select(
      "id, name, unit, current_quantity, minimum_quantity, active, product_id, department_id, departments(code, name), products(category_id, stock_unit_label, categories(name))",
    )
    .eq("id", stockItemId)
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const item = mapStockItem(data as StockItemRow);

  if (!item) {
    return null;
  }

  const [enriched] = await attachEstimatedCosts(workspace, [item]);
  return enriched ?? null;
}

export async function validateStockItemAccess(
  workspace: WorkspaceContext,
  stockItemId: string,
): Promise<StockListItem | null> {
  return getStockItemById(workspace, stockItemId);
}

type ProductLinkRow = {
  id: string;
  name: string;
  unit: string;
  active: boolean;
  departments: { code: string } | { code: string }[] | null;
};

type StockProductLinkRow = {
  id: string;
  name: string;
  product_id: string | null;
};

export async function listProductsForStockLink(
  workspace: WorkspaceContext,
): Promise<StockProductOption[]> {
  const supabase = await createClient();

  const [{ data: products, error: productsError }, { data: stockLinks, error: linksError }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, unit, active, departments(code)")
        .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("stock_items")
        .select("id, name, product_id")
        .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
        .not("product_id", "is", null),
    ]);

  if (productsError || linksError || !products) {
    return [];
  }

  const linkByProductId = new Map<string, { id: string; name: string }>();

  for (const row of (stockLinks ?? []) as StockProductLinkRow[]) {
    if (row.product_id) {
      linkByProductId.set(row.product_id, { id: row.id, name: row.name });
    }
  }

  return products.flatMap((row) => {
    const product = row as ProductLinkRow;
    const department = readSingle(product.departments);

    if (!department) {
      return [];
    }

    const link = linkByProductId.get(product.id) ?? null;

    return [
      {
        id: product.id,
        name: product.name,
        departmentCode: department.code,
        unit: product.unit,
        linkedStockItemId: link?.id ?? null,
        linkedStockItemName: link?.name ?? null,
      },
    ];
  });
}

export async function validateProductForStockLink(
  workspace: WorkspaceContext,
  productId: string,
  departmentId: string,
): Promise<{ valid: boolean; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("id, department_id, establishment_id, organization_id")
    .eq("id", productId)
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .eq("organization_id", workspace.organizationId)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    return { valid: false, error: "Produit vendu introuvable pour cet établissement." };
  }

  if (data.department_id !== departmentId) {
    return {
      valid: false,
      error: "Le produit sélectionné n'appartient pas au même département.",
    };
  }

  return { valid: true };
}

export async function findExistingStockItemForProduct(
  workspace: WorkspaceContext,
  productId: string,
): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stock_items")
    .select("id, name")
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .eq("product_id", productId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getSupplierById(
  workspace: WorkspaceContext,
  supplierId: string,
): Promise<SupplierOption | null> {
  const supabase = await createClient();

  let { data, error } = await supabase
    .from("suppliers")
    .select("id, name, phone, address, active, department_code")
    .eq("id", supplierId)
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .maybeSingle();

  if (error && (error.message ?? "").toLowerCase().includes("department_code")) {
    const fallback = await supabase
      .from("suppliers")
      .select("id, name, phone, address, active")
      .eq("id", supplierId)
      .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
      .maybeSingle();
    data = fallback.data
      ? { ...fallback.data, department_code: "BAR" }
      : null;
    error = fallback.error;
  }

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    address: data.address,
    active: data.active,
    departmentCode: data.department_code === "KITCHEN" ? "KITCHEN" : "BAR",
  };
}
