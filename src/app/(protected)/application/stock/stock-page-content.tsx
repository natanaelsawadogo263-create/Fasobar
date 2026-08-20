import { Suspense } from "react";

import { StockWorkspace } from "@/components/stock/stock-workspace";
import { PageLoadingShell } from "@/components/layout/page-loading-shell";
import { isRetailActivity } from "@/lib/activity/profile";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { loadStockPageData } from "@/lib/stock/page-data";

type StockPageContentProps = {
  workspace: WorkspaceContext;
  params: {
    tab?: string;
    search?: string;
    category?: string;
    status?: string;
  };
};

async function StockPageContent({ workspace, params }: StockPageContentProps) {
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
  } = await loadStockPageData(params, { workspace });

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
      drinksOnly={serviceScope === "BAR" && !isRetailActivity(workspace.activityCode)}
      serviceScope={serviceScope}
      activityCode={workspace.activityCode}
    />
  );
}

export function StockPageSuspense(props: StockPageContentProps) {
  return (
    <Suspense fallback={<PageLoadingShell label="Ouverture du stock…" />}>
      <StockPageContent {...props} />
    </Suspense>
  );
}
