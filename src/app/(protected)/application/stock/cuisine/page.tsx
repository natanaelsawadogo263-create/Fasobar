import { StockWorkspace } from "@/components/stock/stock-workspace";
import { loadStockPageData } from "@/lib/stock/page-data";

type StockCuisinePageProps = {
  searchParams: Promise<{
    search?: string;
    category?: string;
    status?: string;
  }>;
};

export default async function StockCuisinePage({ searchParams }: StockCuisinePageProps) {
  const params = await searchParams;
  const { workspace, filters, stockItems, suppliers, categories, products, stats, totalStockItemCount } =
    await loadStockPageData(
      { ...params, tab: "kitchen" },
      { defaultTab: "kitchen", basePath: "/application/stock/cuisine" },
    );

  return (
    <StockWorkspace
      establishmentName={workspace.establishmentName}
      stockItems={stockItems}
      suppliers={suppliers}
      categories={categories}
      products={products}
      stats={stats}
      initialTab="kitchen"
      initialSearch={filters.search ?? ""}
      initialCategoryId={filters.categoryId ?? ""}
      initialStatus={filters.status}
      canManageStock={workspace.canManageStock}
      canManageBarStock={workspace.canManageBarStock}
      canManageKitchenStock={workspace.canManageKitchenStock}
      organizationRole={workspace.organizationRole}
      establishmentRole={workspace.establishmentRole}
      totalStockItemCount={totalStockItemCount}
      basePath="/application/stock/cuisine"
    />
  );
}
