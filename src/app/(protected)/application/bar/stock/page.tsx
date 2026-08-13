import { redirect } from "next/navigation";

import { BarSessionGate } from "@/components/bar/bar-session-gate";
import { StockWorkspace } from "@/components/stock/stock-workspace";
import { requireBarManagerContext } from "@/lib/auth/workspace-context";
import { getBarSessionContext } from "@/lib/bar/session-queries";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";
import { loadStockPageData } from "@/lib/stock/page-data";

type BarStockPageProps = {
  searchParams: Promise<{
    search?: string;
    category?: string;
    status?: string;
  }>;
};

export default async function BarStockPage({ searchParams }: BarStockPageProps) {
  const workspace = await requireBarManagerContext();

  if (
    !isPathAllowedForSpace(
      "/application/bar/stock",
      workspace.userSpace,
      workspace.serviceScope,
      workspace.activityCode,
    )
  ) {
    redirect("/application/acces-refuse");
  }

  const params = await searchParams;
  const [{ openSession }, pageData] = await Promise.all([
    getBarSessionContext(workspace),
    loadStockPageData(
      { ...params, tab: "bar" },
      { defaultTab: "bar", basePath: "/application/bar/stock" },
    ),
  ]);

  const {
    filters,
    stockItems,
    suppliers,
    categories,
    products,
    stats,
    packagingsByProduct,
    totalStockItemCount,
  } = pageData;

  return (
    <BarSessionGate
      openSession={openSession}
      managerName={workspace.ownerName}
      requireSession
      showBanner={false}
    >
      <StockWorkspace
        establishmentName={workspace.establishmentName}
        stockItems={stockItems}
        suppliers={suppliers}
        categories={categories}
        products={products}
        stats={stats}
        packagingsByProduct={packagingsByProduct}
        initialTab="bar"
        initialSearch={filters.search ?? ""}
        initialCategoryId={filters.categoryId ?? ""}
        initialStatus={filters.status}
        canManageStock={workspace.canManageBarStock}
        canManageBarStock={workspace.canManageBarStock}
        canManageKitchenStock={false}
        organizationRole={workspace.organizationRole}
        establishmentRole={workspace.establishmentRole}
        totalStockItemCount={totalStockItemCount}
        basePath="/application/bar/stock"
        drinksOnly
      />
    </BarSessionGate>
  );
}
