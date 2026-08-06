import "server-only";

import { listCategories } from "@/lib/products/queries";
import { ensureBarStockItemsFromProducts } from "@/lib/bar/ensure-stock";
import { listPackagingsForProducts } from "@/lib/products/packaging-queries";
import {
  getStockStats,
  listProductsForStockLink,
  listStockItems,
  listSuppliers,
} from "@/lib/stock/queries";
import { stockFiltersSchema, type StockTab } from "@/lib/stock/schemas";
import { requireStockReadContext } from "@/lib/auth/workspace-context";

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

export async function loadStockPageData(
  params: StockPageParams,
  options: StockPageOptions = {},
) {
  const workspace = await requireStockReadContext();

  const filters = stockFiltersSchema.parse({
    tab: (params.tab as StockTab | undefined) ?? options.defaultTab ?? "all",
    search: params.search ?? "",
    categoryId: params.category ?? "",
    status: params.status ?? "all",
  });

  // Les produits BAR créés par l'admin deviennent automatiquement des articles de stock.
  await ensureBarStockItemsFromProducts(workspace);

  const [stockItems, suppliers, categories, products, allStockItems] =
    await Promise.all([
      listStockItems(workspace, filters),
      listSuppliers(workspace),
      listCategories(workspace),
      listProductsForStockLink(workspace),
      listStockItems(workspace, { tab: "all", status: "all" }),
    ]);

  const productIds = allStockItems
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));
  const packagingsByProduct = await listPackagingsForProducts(workspace, productIds);

  const scopedItems =
    options.defaultTab === "bar"
      ? allStockItems.filter((item) => item.departmentCode === "BAR")
      : options.defaultTab === "kitchen"
        ? allStockItems.filter((item) => item.departmentCode === "KITCHEN")
        : allStockItems;

  const stats = await getStockStats(workspace, scopedItems);

  return {
    workspace,
    filters,
    stockItems,
    suppliers,
    categories,
    products,
    stats,
    packagingsByProduct,
    totalStockItemCount: scopedItems.length,
    basePath: options.basePath ?? "/application/stock",
  };
}
