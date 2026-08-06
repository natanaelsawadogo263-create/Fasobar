import { StockWorkspace } from "@/components/stock/stock-workspace";
import { loadStockPageData } from "@/lib/stock/page-data";

type StockBoissonsPageProps = {
  searchParams: Promise<{
    search?: string;
    category?: string;
    status?: string;
  }>;
};

export default async function StockBoissonsPage({ searchParams }: StockBoissonsPageProps) {
  const params = await searchParams;
  const { workspace, filters, stockItems, suppliers, categories, products, stats, totalStockItemCount } =
    await loadStockPageData(
      { ...params, tab: "bar" },
      { defaultTab: "bar", basePath: "/application/stock/boissons" },
    );

  return (
    <StockWorkspace
      establishmentName={workspace.establishmentName}
      stockItems={stockItems}
      suppliers={suppliers}
      categories={categories}
      products={products}
      stats={stats}
      initialTab="bar"
      initialSearch={filters.search ?? ""}
      initialCategoryId={filters.categoryId ?? ""}
      initialStatus={filters.status}
      canManageStock={workspace.canManageStock}
      canManageBarStock={workspace.canManageBarStock}
      canManageKitchenStock={workspace.canManageKitchenStock}
      organizationRole={workspace.organizationRole}
      establishmentRole={workspace.establishmentRole}
      totalStockItemCount={totalStockItemCount}
      basePath="/application/stock/boissons"
    />
  );
}
