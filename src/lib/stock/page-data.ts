import "server-only";

import { listCategories } from "@/lib/products/queries";
import { ensureBarStockItemsFromProducts } from "@/lib/bar/ensure-stock";
import { listPackagingsForProductsMerged } from "@/lib/products/packaging-queries";
import {
  getStockStats,
  listProductsForStockLink,
  listStockItems,
  listSuppliers,
} from "@/lib/stock/queries";
import { stockFiltersSchema, type StockTab } from "@/lib/stock/schemas";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { requireStockReadContext } from "@/lib/auth/workspace-context";
import {
  defaultStockTab,
  hasBarService,
  hasKitchenService,
} from "@/lib/settings/service-scope";
import type { StockListItem } from "@/lib/stock/types";

type StockPageParams = {
  tab?: string;
  search?: string;
  category?: string;
  status?: string;
};

type StockPageOptions = {
  defaultTab?: StockTab;
  basePath?: string;
};

function scopeStockTab(
  requested: StockTab,
  serviceScope: "BOTH" | "BAR" | "KITCHEN",
  forced?: StockTab,
): StockTab {
  if (forced) return forced;
  if (requested === "alerts" || requested === "all") {
    if (serviceScope === "BAR") return requested === "alerts" ? "alerts" : "bar";
    if (serviceScope === "KITCHEN") return requested === "alerts" ? "alerts" : "kitchen";
    return requested;
  }
  if (requested === "bar" && !hasBarService(serviceScope)) {
    return defaultStockTab(serviceScope);
  }
  if (requested === "kitchen" && !hasKitchenService(serviceScope)) {
    return defaultStockTab(serviceScope);
  }
  return requested;
}

function matchesStockFilters(
  item: StockListItem,
  filters: {
    search?: string;
    categoryId?: string;
    status: string;
    tab: StockTab;
  },
): boolean {
  if (filters.tab === "bar" && item.departmentCode !== "BAR") return false;
  if (filters.tab === "kitchen" && item.departmentCode !== "KITCHEN") return false;
  if (filters.tab === "alerts" && item.status !== "low" && item.status !== "out") {
    return false;
  }
  if (filters.status === "ok" && item.status !== "ok") return false;
  if (filters.status === "inactive" && item.status !== "inactive") return false;
  if (filters.status === "low" && item.status !== "low") return false;
  if (filters.status === "out" && item.status !== "out") return false;
  if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    if (!item.name.toLowerCase().includes(q)) return false;
  }
  return true;
}

export async function loadStockPageData(
  params: StockPageParams,
  options: StockPageOptions & { workspace?: WorkspaceContext } = {},
) {
  const workspace = options.workspace ?? (await requireStockReadContext());
  const scope = workspace.serviceScope;

  const requestedTab =
    (params.tab as StockTab | undefined) ?? options.defaultTab ?? "all";
  const tab = scopeStockTab(requestedTab, scope, options.defaultTab);

  const filters = stockFiltersSchema.parse({
    tab,
    search: params.search ?? "",
    categoryId: params.category ?? "",
    status: params.status ?? "all",
  });

  const listTab: StockTab =
    filters.tab === "alerts"
      ? scope === "BAR"
        ? "bar"
        : scope === "KITCHEN"
          ? "kitchen"
          : "all"
      : filters.tab;

  const wantBar = hasBarService(scope) && listTab !== "kitchen";
  const wantKitchen = hasKitchenService(scope) && listTab !== "bar";

  if (wantBar) {
    void ensureBarStockItemsFromProducts(workspace);
  }

  const [barItems, kitchenItems, suppliers, categories, products] =
    await Promise.all([
      wantBar
        ? listStockItems(workspace, { tab: "bar", status: "all" })
        : Promise.resolve([] as StockListItem[]),
      wantKitchen
        ? listStockItems(workspace, { tab: "kitchen", status: "all" })
        : Promise.resolve([] as StockListItem[]),
      listSuppliers(workspace, {
        departmentCode:
          scope === "BAR" ? "BAR" : scope === "KITCHEN" ? "KITCHEN" : undefined,
      }),
      listCategories(workspace),
      listProductsForStockLink(workspace),
    ]);

  const allStockItems = [...barItems, ...kitchenItems];
  const stockItems = allStockItems.filter((item) =>
    matchesStockFilters(item, {
      ...filters,
      tab: filters.tab === "alerts" ? "alerts" : listTab,
    }),
  );

  const scopedCategories = categories.filter((category) => {
    if (category.departmentCode === "BAR") return hasBarService(scope);
    if (category.departmentCode === "KITCHEN") return hasKitchenService(scope);
    return true;
  });
  const scopedProducts = products.filter((product) => {
    if (product.departmentCode === "BAR") return hasBarService(scope);
    if (product.departmentCode === "KITCHEN") return hasKitchenService(scope);
    return true;
  });

  const productIds = allStockItems
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));

  const [packagingsByProduct, stats] = await Promise.all([
    listPackagingsForProductsMerged(workspace, productIds),
    getStockStats(workspace, allStockItems),
  ]);

  return {
    workspace,
    filters,
    stockItems,
    suppliers,
    categories: scopedCategories,
    products: scopedProducts,
    stats,
    packagingsByProduct,
    totalStockItemCount: allStockItems.length,
    basePath: options.basePath ?? "/application/stock",
    serviceScope: scope,
  };
}
