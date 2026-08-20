import { redirect } from "next/navigation";

import { BarSessionGate } from "@/components/bar/bar-session-gate";
import { SupplyWorkspace } from "@/components/stock/supply-workspace";
import { ensureBarStockItemsFromProducts } from "@/lib/bar/ensure-stock";
import { requireBarManagerContext } from "@/lib/auth/workspace-context";
import { getBarSessionContext } from "@/lib/bar/session-queries";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";
import {
  formatOrderPeriodLabel,
  resolveOrderPeriodRange,
  toLocalIsoDate,
} from "@/lib/orders/period";
import { listPackagingsForProducts } from "@/lib/products/packaging-queries";
import {
  listRecentSupplyEntries,
  listStockItems,
  listSuppliers,
  listSupplyReceipts,
} from "@/lib/stock/queries";

type ApprovisionnementPeriod = "day" | "week" | "month" | "custom";

type BarApprovisionnementsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePeriod(value: string | undefined, hasCustomDates: boolean): ApprovisionnementPeriod {
  if (value === "week" || value === "month" || value === "day" || value === "custom") {
    return value;
  }
  return hasCustomDates ? "custom" : "day";
}

export default async function BarApprovisionnementsPage({
  searchParams,
}: BarApprovisionnementsPageProps) {
  const workspace = await requireBarManagerContext();

  if (
    !isPathAllowedForSpace(
      "/application/bar/approvisionnements",
      workspace.userSpace,
      workspace.serviceScope,
      workspace.activityCode,
    )
  ) {
    redirect("/application/acces-refuse");
  }

  const raw = await searchParams;
  const hasCustomDates =
    typeof raw.from === "string" || typeof raw.to === "string";
  const periodFilter = parsePeriod(
    typeof raw.period === "string" ? raw.period : undefined,
    hasCustomDates,
  );
  const periodRange =
    periodFilter === "custom"
      ? {
          from: typeof raw.from === "string" ? raw.from : undefined,
          to: typeof raw.to === "string" ? raw.to : undefined,
        }
      : resolveOrderPeriodRange(
          periodFilter,
          typeof raw.anchor === "string" ? raw.anchor : toLocalIsoDate(new Date()),
        );

  const [{ openSession }, suppliers, stockItems, recentEntries, receipts] =
    await Promise.all([
      getBarSessionContext(workspace),
      listSuppliers(workspace, { departmentCode: "BAR" }),
      listStockItems(workspace, { tab: "bar", status: "all" }),
      listRecentSupplyEntries(workspace, {
        departmentCode: "BAR",
        from: periodRange.from,
        to: periodRange.to,
        limit: 100,
      }),
      listSupplyReceipts(workspace, {
        from: periodRange.from,
        to: periodRange.to,
        limit: 60,
      }),
    ]);

  // Sync stock hors chemin critique.
  void ensureBarStockItemsFromProducts(workspace);

  const productIds = stockItems
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));
  const packagingsByProduct = await listPackagingsForProducts(
    workspace,
    productIds,
  );

  return (
    <BarSessionGate
      openSession={openSession}
      managerName={workspace.ownerName}
      requireSession
      showBanner={false}
    >
      <SupplyWorkspace
        establishmentName={workspace.establishmentName}
        suppliers={suppliers}
        stockItems={stockItems}
        recentEntries={recentEntries}
        receipts={receipts}
        packagingsByProduct={packagingsByProduct}
        canManageStock={workspace.canManageBarStock}
        compact
        lockedDepartment="BAR"
        periodFilter={periodFilter}
        periodFrom={periodRange.from}
        periodTo={periodRange.to}
        periodLabel={formatOrderPeriodLabel(
          periodFilter === "custom" ? "day" : periodFilter,
          periodRange.from,
          periodRange.to,
        )}
        periodBasePath="/application/bar/approvisionnements"
        activityCode={workspace.activityCode}
      />
    </BarSessionGate>
  );
}
