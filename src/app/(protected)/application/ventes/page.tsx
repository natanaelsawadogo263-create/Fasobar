import { requireAdminContext } from "@/lib/auth/workspace-context";
import { listOrderCashiers } from "@/lib/orders/queries";
import {
  formatOrderPeriodLabel,
  resolveOrderPeriodRange,
  toLocalIsoDate,
} from "@/lib/orders/period";
import { getAdminSalesData } from "@/lib/sales/queries";
import { salesFiltersSchema } from "@/lib/sales/schemas";
import { AdminSalesWorkspace } from "@/components/admin/admin-sales-workspace";

type VentesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type SalesPeriodFilter = "day" | "week" | "month" | "custom" | "all";

function parsePeriod(value: string | undefined, hasDates: boolean): SalesPeriodFilter {
  if (value === "week" || value === "month" || value === "day" || value === "custom" || value === "all") {
    return value;
  }
  if (hasDates) return "custom";
  return "day";
}

function formatCustomRange(from?: string, to?: string): string {
  const format = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${iso}T12:00:00`));

  if (from && to) {
    return from === to ? format(from) : `${format(from)} → ${format(to)}`;
  }
  if (from) return `Depuis ${format(from)}`;
  if (to) return `Jusqu’au ${format(to)}`;
  return "Période libre";
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
      : periodFilter === "all"
        ? { from: undefined, to: undefined }
        : resolveOrderPeriodRange(periodFilter, toLocalIsoDate(new Date()));

  const parsed = salesFiltersSchema.safeParse({
    from: periodRange.from,
    to: periodRange.to,
    cashierId: typeof raw.cashierId === "string" ? raw.cashierId : undefined,
  });

  const filters = parsed.success ? parsed.data : {};

  const [data, cashiers] = await Promise.all([
    getAdminSalesData(workspace, filters),
    listOrderCashiers(workspace),
  ]);

  const periodLabel =
    periodFilter === "all"
      ? "Toutes les périodes"
      : periodFilter === "custom"
        ? formatCustomRange(filters.from, filters.to)
        : formatOrderPeriodLabel(periodFilter, filters.from, filters.to);

  return (
    <AdminSalesWorkspace
      data={data}
      filters={filters}
      cashiers={cashiers}
      establishmentName={workspace.establishmentName}
      serviceScope={workspace.serviceScope}
      activityCode={workspace.activityCode}
      periodFilter={periodFilter}
      periodLabel={periodLabel}
    />
  );
}
