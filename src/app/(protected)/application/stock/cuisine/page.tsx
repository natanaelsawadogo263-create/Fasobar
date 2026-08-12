import { redirect } from "next/navigation";

import { StockWorkspace } from "@/components/stock/stock-workspace";
import { hasKitchenService } from "@/lib/settings/service-scope";
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
  const data = await loadStockPageData(
    { ...params, tab: "kitchen" },
    { defaultTab: "kitchen", basePath: "/application/stock/cuisine" },
  );

  if (!hasKitchenService(data.serviceScope)) {
    redirect("/application/stock");
  }

  return (
    <StockWorkspace
      establishmentName={data.workspace.establishmentName}
      stockItems={data.stockItems}
      suppliers={data.suppliers}
      categories={data.categories}
      products={data.products}
      stats={data.stats}
      packagingsByProduct={data.packagingsByProduct}
      initialTab="kitchen"
      initialSearch={data.filters.search ?? ""}
      initialCategoryId={data.filters.categoryId ?? ""}
      initialStatus={data.filters.status}
      canManageStock={data.workspace.canManageStock}
      canManageBarStock={data.workspace.canManageBarStock}
      canManageKitchenStock={data.workspace.canManageKitchenStock}
      organizationRole={data.workspace.organizationRole}
      establishmentRole={data.workspace.establishmentRole}
      totalStockItemCount={data.totalStockItemCount}
      basePath="/application/stock/cuisine"
      serviceScope={data.serviceScope}
    />
  );
}
