import { VentesPageSuspense } from "@/app/(protected)/application/ventes/ventes-page-content";
import { requireAdminContext } from "@/lib/auth/workspace-context";
import { resolveOrderPeriodRange, toLocalIsoDate } from "@/lib/orders/period";
import { salesFiltersSchema, type SalesPeriodFilter } from "@/lib/sales/schemas";

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
  const [workspace, raw] = await Promise.all([
    requireAdminContext(),
    searchParams,
  ]);
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

  const filters = parsed.success
    ? parsed.data
    : { ...periodRange, period: periodFilter };

  return <VentesPageSuspense workspace={workspace} filters={filters} />;
}
