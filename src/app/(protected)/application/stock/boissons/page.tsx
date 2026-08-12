import { redirect } from "next/navigation";

import { StockWorkspace } from "@/components/stock/stock-workspace";
import { hasBarService } from "@/lib/settings/service-scope";
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
  const data = await loadStockPageData(
    { ...params, tab: "bar" },
    { defaultTab: "bar", basePath: "/application/stock/boissons" },
  );

  if (!hasBarService(data.serviceScope)) {
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
      initialTab="bar"
      initialSearch={data.filters.search ?? ""}
      initialCategoryId={data.filters.categoryId ?? ""}
      initialStatus={data.filters.status}
      canManageStock={data.workspace.canManageStock}
      canManageBarStock={data.workspace.canManageBarStock}
      canManageKitchenStock={data.workspace.canManageKitchenStock}
      organizationRole={data.workspace.organizationRole}
      establishmentRole={data.workspace.establishmentRole}
      totalStockItemCount={data.totalStockItemCount}
      basePath="/application/stock/boissons"
      drinksOnly
      serviceScope={data.serviceScope}
    />
  );
}
