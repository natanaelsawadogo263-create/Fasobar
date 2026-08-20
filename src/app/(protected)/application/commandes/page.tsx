import { CommandesPageSuspense } from "@/app/(protected)/application/commandes/commandes-page-content";
import { requireAdminContext } from "@/lib/auth/workspace-context";
import {
  resolveOrderPeriodRange,
  toLocalIsoDate,
} from "@/lib/orders/period";
import { adminOrderFiltersSchema } from "@/lib/orders/schemas";
import { coerceAdminOrderDepartment } from "@/lib/settings/service-scope";

type CommandesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommandesPage({ searchParams }: CommandesPageProps) {
  const [workspace, raw] = await Promise.all([
    requireAdminContext(),
    searchParams,
  ]);

  const parsed = adminOrderFiltersSchema.safeParse({
    status: typeof raw.status === "string" ? raw.status : "all",
    department: typeof raw.department === "string" ? raw.department : "all",
    period:
      typeof raw.period === "string"
        ? raw.period
        : typeof raw.from === "string" || typeof raw.to === "string"
          ? "custom"
          : "day",
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
        period: "day" as const,
        search: typeof raw.search === "string" ? raw.search : undefined,
      };

  const period = baseFilters.period ?? "day";
  const range =
    period === "all" || period === "custom"
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

  return <CommandesPageSuspense workspace={workspace} filters={filters} />;
}
