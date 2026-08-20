import { DepensesPageSuspense } from "@/app/(protected)/application/depenses/depenses-page-content";
import { requireSpacePathAccess } from "@/lib/auth/workspace-context";
import { isRetailShopOps } from "@/lib/activity/ops-model";
import {
  expenseFiltersSchema,
  type ExpenseArea,
  type ExpenseFiltersInput,
} from "@/lib/expenses/schemas";
import {
  formatOrderPeriodLabel,
  resolveOrderPeriodRange,
  toLocalIsoDate,
} from "@/lib/orders/period";

type DepensesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ExpensePeriodFilter = "day" | "week" | "month" | "custom";

function lockedAreaForSpace(
  space: "admin" | "cashier_kitchen" | "bar_manager",
  activityCode?: string | null,
): ExpenseArea | null {
  if (isRetailShopOps(activityCode) && space === "bar_manager") return null;
  if (space === "bar_manager") return "BAR";
  if (space === "cashier_kitchen") return "CAISSE";
  return null;
}

function parsePeriod(value: string | undefined): ExpensePeriodFilter {
  if (value === "week" || value === "month" || value === "day" || value === "custom") {
    return value;
  }
  return "day";
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

export default async function DepensesPage({ searchParams }: DepensesPageProps) {
  const [workspace, raw] = await Promise.all([
    requireSpacePathAccess("/application/depenses"),
    searchParams,
  ]);
  const lockedArea = lockedAreaForSpace(workspace.userSpace, workspace.activityCode);

  const hasCustomDates =
    typeof raw.from === "string" || typeof raw.to === "string";
  const periodFilter = parsePeriod(
    typeof raw.period === "string"
      ? raw.period
      : hasCustomDates
        ? "custom"
        : "day",
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

  const parsed = expenseFiltersSchema.safeParse({
    area:
      lockedArea ??
      (typeof raw.area === "string" ? raw.area : ""),
    category: typeof raw.category === "string" ? raw.category : "",
    status: typeof raw.status === "string" ? raw.status : "all",
    search: typeof raw.search === "string" ? raw.search : undefined,
    from: periodRange.from,
    to: periodRange.to,
  });

  const filters: ExpenseFiltersInput = parsed.success
    ? {
        ...parsed.data,
        area: lockedArea ?? parsed.data.area ?? "",
        from: periodRange.from ?? parsed.data.from,
        to: periodRange.to ?? parsed.data.to,
      }
    : {
        status: "all",
        area: lockedArea ?? "",
        from: periodRange.from,
        to: periodRange.to,
      };

  const periodLabel =
    periodFilter === "custom"
      ? formatCustomPeriodLabel(periodRange.from, periodRange.to)
      : formatOrderPeriodLabel(periodFilter, periodRange.from, periodRange.to);

  return (
    <DepensesPageSuspense
      workspace={workspace}
      filters={filters}
      lockedArea={lockedArea}
      periodFilter={periodFilter}
      periodLabel={periodLabel}
    />
  );
}
