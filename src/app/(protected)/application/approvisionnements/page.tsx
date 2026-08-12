import { redirect } from "next/navigation";

import { SupplyWorkspace } from "@/components/stock/supply-workspace";
import { ensureBarStockItemsFromProducts } from "@/lib/bar/ensure-stock";
import { requireStockReadContext } from "@/lib/auth/workspace-context";
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
} from "@/lib/stock/queries";

type ApprovisionnementPeriod = "day" | "week" | "month";

type ApprovisionnementsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePeriod(value: string | undefined): ApprovisionnementPeriod {
  if (value === "week" || value === "month" || value === "day") return value;
  return "day";
}

export default async function ApprovisionnementsPage({
  searchParams,
}: ApprovisionnementsPageProps) {
  const workspace = await requireStockReadContext();

  if (!isPathAllowedForSpace("/application/approvisionnements", workspace.userSpace)) {
    redirect("/application/acces-refuse");
  }

  const raw = await searchParams;
  const lockedDepartment =
    workspace.userSpace === "cashier_kitchen" ? ("KITCHEN" as const) : null;

  const periodFilter = lockedDepartment
    ? parsePeriod(typeof raw.period === "string" ? raw.period : "day")
    : null;

  const periodRange = periodFilter
    ? resolveOrderPeriodRange(
        periodFilter,
        typeof raw.anchor === "string" ? raw.anchor : toLocalIsoDate(new Date()),
      )
    : { from: undefined, to: undefined };

  const [suppliers, barItems, kitchenItems, recentEntries] = await Promise.all([
    listSuppliers(
      workspace,
      lockedDepartment ? { departmentCode: lockedDepartment } : {},
    ),
    lockedDepartment === "KITCHEN"
      ? Promise.resolve([])
      : ensureBarStockItemsFromProducts(workspace),
    listStockItems(workspace, { tab: "kitchen", status: "all" }),
    listRecentSupplyEntries(workspace, {
      ...(lockedDepartment ? { departmentCode: lockedDepartment } : {}),
      from: periodRange.from,
      to: periodRange.to,
      limit: 500,
    }),
  ]);

  const stockItems =
    lockedDepartment === "KITCHEN" ? kitchenItems : [...barItems, ...kitchenItems];
  const productIds = stockItems
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));
  const packagingsByProduct = await listPackagingsForProducts(workspace, productIds);

  return (
    <SupplyWorkspace
      establishmentName={workspace.establishmentName}
      suppliers={suppliers}
      stockItems={stockItems}
      recentEntries={recentEntries}
      packagingsByProduct={packagingsByProduct}
      canManageStock={
        lockedDepartment === "KITCHEN"
          ? workspace.canManageKitchenStock
          : workspace.canManageStock
      }
      lockedDepartment={lockedDepartment}
      periodFilter={periodFilter}
      periodLabel={
        periodFilter
          ? formatOrderPeriodLabel(periodFilter, periodRange.from, periodRange.to)
          : null
      }
      periodBasePath="/application/approvisionnements"
    />
  );
}
