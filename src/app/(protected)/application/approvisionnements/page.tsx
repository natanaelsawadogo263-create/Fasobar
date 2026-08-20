import { redirect } from "next/navigation";

import { SupplyWorkspace } from "@/components/stock/supply-workspace";
import { isRetailActivity } from "@/lib/activity/profile";
import { ensureBarStockItemsFromProducts } from "@/lib/bar/ensure-stock";
import { listProducts } from "@/lib/products/queries";
import { requireStockReadContext } from "@/lib/auth/workspace-context";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";
import {
  formatOrderPeriodLabel,
  resolveOrderPeriodRange,
  toLocalIsoDate,
} from "@/lib/orders/period";
import { listPackagingsForProductsMerged } from "@/lib/products/packaging-queries";
import {
  defaultDepartmentCode,
  hasBarService,
  hasKitchenService,
  isSingleServiceScope,
} from "@/lib/settings/service-scope";
import {
  listRecentSupplyEntries,
  listStockItems,
  listSuppliers,
  listSupplyReceipts,
} from "@/lib/stock/queries";

type ApprovisionnementPeriod = "day" | "week" | "month" | "custom";

type ApprovisionnementsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePeriod(value: string | undefined, hasCustomDates: boolean): ApprovisionnementPeriod {
  if (value === "week" || value === "month" || value === "day" || value === "custom") {
    return value;
  }
  return hasCustomDates ? "custom" : "day";
}

function formatCustomPeriodLabel(from?: string, to?: string): string {
  const format = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${iso}T12:00:00`));

  if (from && to) {
    if (from === to) return format(from);
    return `${format(from)} → ${format(to)}`;
  }
  if (from) return `Depuis ${format(from)}`;
  if (to) return `Jusqu’au ${format(to)}`;
  return "Période libre";
}

export default async function ApprovisionnementsPage({
  searchParams,
}: ApprovisionnementsPageProps) {
  const [workspace, raw] = await Promise.all([
    requireStockReadContext(),
    searchParams,
  ]);
  if (
    !isPathAllowedForSpace(
      "/application/approvisionnements",
      workspace.userSpace,
      workspace.serviceScope,
      workspace.activityCode,
    )
  ) {
    redirect("/application/acces-refuse");
  }

  const scope = workspace.serviceScope;
  const lockedDepartment =
    workspace.userSpace === "cashier_kitchen"
      ? isRetailActivity(workspace.activityCode)
        ? ("BAR" as const)
        : ("KITCHEN" as const)
      : isSingleServiceScope(scope)
        ? defaultDepartmentCode(scope)
        : null;

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

  const loadBar = !lockedDepartment
    ? hasBarService(scope)
    : lockedDepartment === "BAR";
  const loadKitchen = !lockedDepartment
    ? hasKitchenService(scope)
    : lockedDepartment === "KITCHEN";

  if (loadBar) {
    void ensureBarStockItemsFromProducts(workspace);
  }

  const packagingsPromise = loadBar
    ? listProducts(workspace, { tab: "bar", search: "", categoryId: "" }).then(
        (barProducts) => {
          const ids = barProducts.map((product) => product.id);
          return ids.length > 0
            ? listPackagingsForProductsMerged(workspace, ids)
            : {};
        },
      )
    : Promise.resolve({});

  const [suppliers, barItems, kitchenItems, recentEntries, receipts, packagingsByProduct] =
    await Promise.all([
    listSuppliers(
      workspace,
      lockedDepartment ? { departmentCode: lockedDepartment } : {},
    ),
    loadBar ? listStockItems(workspace, { tab: "bar", status: "all" }) : Promise.resolve([]),
    loadKitchen
      ? listStockItems(workspace, { tab: "kitchen", status: "all" })
      : Promise.resolve([]),
    listRecentSupplyEntries(workspace, {
      ...(lockedDepartment ? { departmentCode: lockedDepartment } : {}),
      from: periodRange.from,
      to: periodRange.to,
      limit: 100,
    }),
    listSupplyReceipts(workspace, {
      from: periodRange.from,
      to: periodRange.to,
      limit: 60,
    }),
    packagingsPromise,
  ]);

  const stockItems = [...barItems, ...kitchenItems];

  return (
    <SupplyWorkspace
      establishmentName={workspace.establishmentName}
      suppliers={suppliers}
      stockItems={stockItems}
      recentEntries={recentEntries}
      receipts={receipts}
      packagingsByProduct={packagingsByProduct}
      canManageStock={
        lockedDepartment === "KITCHEN"
          ? workspace.canManageKitchenStock
          : lockedDepartment === "BAR"
            ? workspace.canManageBarStock || workspace.canManageStock
            : workspace.canManageStock
      }
      canReopenSupply={workspace.userSpace === "admin"}
      lockedDepartment={lockedDepartment}
      serviceScope={scope}
      periodFilter={periodFilter}
      periodFrom={periodRange.from}
      periodTo={periodRange.to}
      periodLabel={
        periodFilter === "custom"
          ? formatCustomPeriodLabel(periodRange.from, periodRange.to)
          : formatOrderPeriodLabel(periodFilter, periodRange.from, periodRange.to)
      }
      periodBasePath="/application/approvisionnements"
      activityCode={workspace.activityCode}
    />
  );
}
