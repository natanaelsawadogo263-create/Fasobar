import { ExpensesWorkspace } from "@/components/expenses/expenses-workspace";
import { requireSpacePathAccess } from "@/lib/auth/workspace-context";
import {
  expenseFiltersSchema,
  type ExpenseArea,
  type ExpenseFiltersInput,
} from "@/lib/expenses/schemas";
import { listExpenses } from "@/lib/expenses/queries";
import {
  formatOrderPeriodLabel,
  resolveOrderPeriodRange,
  toLocalIsoDate,
} from "@/lib/orders/period";

type DepensesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ExpensePeriodFilter = "day" | "week" | "month";

function lockedAreaForSpace(
  space: "admin" | "cashier_kitchen" | "bar_manager",
): ExpenseArea | null {
  if (space === "bar_manager") return "BAR";
  if (space === "cashier_kitchen") return "CAISSE";
  return null;
}

function parsePeriod(value: string | undefined): ExpensePeriodFilter {
  if (value === "week" || value === "month" || value === "day") return value;
  return "day";
}

export default async function DepensesPage({ searchParams }: DepensesPageProps) {
  const workspace = await requireSpacePathAccess("/application/depenses");
  const raw = await searchParams;
  const lockedArea = lockedAreaForSpace(workspace.userSpace);

  const periodFilter = lockedArea
    ? parsePeriod(typeof raw.period === "string" ? raw.period : "day")
    : null;

  const periodRange = periodFilter
    ? resolveOrderPeriodRange(
        periodFilter,
        typeof raw.anchor === "string" ? raw.anchor : toLocalIsoDate(new Date()),
      )
    : {
        from: typeof raw.from === "string" ? raw.from : undefined,
        to: typeof raw.to === "string" ? raw.to : undefined,
      };

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

  const data = await listExpenses(workspace, filters);

  return (
    <ExpensesWorkspace
      {...data}
      filters={filters}
      establishmentName={workspace.establishmentName}
      lockedArea={lockedArea}
      periodFilter={periodFilter}
      periodLabel={
        periodFilter
          ? formatOrderPeriodLabel(periodFilter, periodRange.from, periodRange.to)
          : null
      }
      canManage
    />
  );
}
