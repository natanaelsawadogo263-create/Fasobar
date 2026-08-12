import { redirect } from "next/navigation";

import { StockWorkspace } from "@/components/stock/stock-workspace";
import { requireStockReadContext } from "@/lib/auth/workspace-context";
import { hasBarService, hasKitchenService } from "@/lib/settings/service-scope";
import { loadStockPageData } from "@/lib/stock/page-data";

type StockPageProps = {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    category?: string;
    status?: string;
  }>;
};

export default async function StockPage({ searchParams }: StockPageProps) {
  const params = await searchParams;
  const workspace = await requireStockReadContext();

  if (!hasBarService(workspace.serviceScope) && hasKitchenService(workspace.serviceScope)) {
    redirect("/application/stock/cuisine");
  }

  const {
    filters,
    stockItems,
    suppliers,
    categories,
    products,
    stats,
    packagingsByProduct,
    basePath,
    totalStockItemCount,
    serviceScope,
  } = await loadStockPageData(params);

  return (
    <StockWorkspace
      establishmentName={workspace.establishmentName}
      stockItems={stockItems}
      suppliers={suppliers}
      categories={categories}
      products={products}
      stats={stats}
      packagingsByProduct={packagingsByProduct}
      initialTab={filters.tab}
      initialSearch={filters.search ?? ""}
      initialCategoryId={filters.categoryId ?? ""}
      initialStatus={filters.status}
      canManageStock={workspace.canManageStock}
      canManageBarStock={workspace.canManageBarStock}
      canManageKitchenStock={workspace.canManageKitchenStock}
      organizationRole={workspace.organizationRole}
      establishmentRole={workspace.establishmentRole}
      totalStockItemCount={totalStockItemCount}
      basePath={basePath}
      drinksOnly={serviceScope === "BAR"}
      serviceScope={serviceScope}
    />
  );
}
