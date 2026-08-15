import { requireAdminContext } from "@/lib/auth/workspace-context";
import {
  formatOrderPeriodLabel,
  resolveOrderPeriodRange,
  toLocalIsoDate,
} from "@/lib/orders/period";
import { adminOrderFiltersSchema } from "@/lib/orders/schemas";
import { listAdminOrders, listOrderCashiers } from "@/lib/orders/queries";
import { AdminOrdersWorkspace } from "@/components/admin/admin-orders-workspace";
import { coerceAdminOrderDepartment } from "@/lib/settings/service-scope";

type CommandesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommandesPage({ searchParams }: CommandesPageProps) {
  const workspace = await requireAdminContext();
  const raw = await searchParams;

  const parsed = adminOrderFiltersSchema.safeParse({
    status: typeof raw.status === "string" ? raw.status : "all",
    department: typeof raw.department === "string" ? raw.department : "all",
    period: typeof raw.period === "string" ? raw.period : "all",
    cashierId: typeof raw.cashierId === "string" ? raw.cashierId : undefined,
    from: typeof raw.from === "string" ? raw.from : undefined,
    to: typeof raw.to === "string" ? raw.to : undefined,
    search: typeof raw.search === "string" ? raw.search : undefined,
  });

  // Ne jamais perdre la recherche si un autre filtre est invalide.
  const baseFilters = parsed.success
    ? parsed.data
    : {
        status: "all" as const,
        department: "all" as const,
        period: "all" as const,
        search: typeof raw.search === "string" ? raw.search : undefined,
      };

  const period = baseFilters.period ?? "all";
  const range =
    period === "all"
      ? { from: baseFilters.from, to: baseFilters.to }
      : resolveOrderPeriodRange(period, baseFilters.from ?? toLocalIsoDate(new Date()));

  const filters = {
    ...baseFilters,
    department: coerceAdminOrderDepartment(
      workspace.serviceScope,
      baseFilters.department,
    ),
    period,
    from: range.from,
    to: range.to,
  };

  const [data, cashiers] = await Promise.all([
    listAdminOrders(workspace, filters),
    listOrderCashiers(workspace),
  ]);

  return (
    <AdminOrdersWorkspace
      {...data}
      filters={filters}
      periodLabel={formatOrderPeriodLabel(period, filters.from, filters.to)}
      cashiers={cashiers}
      establishmentName={workspace.establishmentName}
      canManageOrders={workspace.canManageOrders}
      serviceScope={workspace.serviceScope}
    />
  );
}
