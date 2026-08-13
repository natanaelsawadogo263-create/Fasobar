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
  listSuppliers,
} from "@/lib/stock/queries";

type ApprovisionnementPeriod = "day" | "week" | "month";

type BarApprovisionnementsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePeriod(value: string | undefined): ApprovisionnementPeriod {
  if (value === "week" || value === "month" || value === "day") return value;
  return "day";
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
  const periodFilter = parsePeriod(
    typeof raw.period === "string" ? raw.period : "day",
  );
  const periodRange = resolveOrderPeriodRange(
    periodFilter,
    typeof raw.anchor === "string" ? raw.anchor : toLocalIsoDate(new Date()),
  );

  const [{ openSession }, suppliers, stockItems, recentEntries] =
    await Promise.all([
      getBarSessionContext(workspace),
      listSuppliers(workspace, { departmentCode: "BAR" }),
      ensureBarStockItemsFromProducts(workspace),
      listRecentSupplyEntries(workspace, {
        departmentCode: "BAR",
        from: periodRange.from,
        to: periodRange.to,
        limit: 500,
      }),
    ]);

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
        packagingsByProduct={packagingsByProduct}
        canManageStock={workspace.canManageBarStock}
        compact
        lockedDepartment="BAR"
        periodFilter={periodFilter}
        periodLabel={formatOrderPeriodLabel(
          periodFilter,
          periodRange.from,
          periodRange.to,
        )}
        periodBasePath="/application/bar/approvisionnements"
        activityCode={workspace.activityCode}
      />
    </BarSessionGate>
  );
}
