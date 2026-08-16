import { requireAdminContext } from "@/lib/auth/workspace-context";
import { listOrderCashiers } from "@/lib/orders/queries";
import { getAdminSalesData } from "@/lib/sales/queries";
import { salesFiltersSchema, type SalesPeriodFilter } from "@/lib/sales/schemas";
import { AdminSalesWorkspace } from "@/components/admin/admin-sales-workspace";
import { resolveOrderPeriodRange, toLocalIsoDate } from "@/lib/orders/period";

type VentesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePeriod(value: string | undefined, hasCustomDates: boolean): SalesPeriodFilter {
  if (value === "week" || value === "month" || value === "day" || value === "custom") {
    return value;
  }
  return hasCustomDates ? "custom" : "day";
}

export default async function VentesPage({ searchParams }: VentesPageProps) {
  const workspace = await requireAdminContext();
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

  const parsed = salesFiltersSchema.safeParse({
    from: periodRange.from,
    to: periodRange.to,
    period: periodFilter,
    cashierId: typeof raw.cashierId === "string" ? raw.cashierId : undefined,
  });

  const filters = parsed.success ? parsed.data : { ...periodRange, period: periodFilter };

  const [data, cashiers] = await Promise.all([
    getAdminSalesData(workspace, filters),
    listOrderCashiers(workspace),
  ]);

  return (
    <AdminSalesWorkspace
      data={data}
      filters={filters}
      cashiers={cashiers}
      establishmentName={workspace.establishmentName}
      serviceScope={workspace.serviceScope}
      activityCode={workspace.activityCode}
    />
  );
}
