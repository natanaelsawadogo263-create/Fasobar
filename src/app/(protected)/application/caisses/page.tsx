import { requireAdminContext } from "@/lib/auth/workspace-context";
import { listAdminCashSessions } from "@/lib/admin/cash-sessions-queries";
import { AdminCashSessionsWorkspace } from "@/components/admin/admin-cash-sessions-workspace";
import {
  resolveOrderPeriodRange,
  toLocalIsoDate,
} from "@/lib/orders/period";

type CaissesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type CaissesPeriod = "day" | "week" | "month" | "custom";

function parsePeriod(value: string | undefined, hasCustomDates: boolean): CaissesPeriod {
  if (value === "week" || value === "month" || value === "day" || value === "custom") {
    return value;
  }
  return hasCustomDates ? "custom" : "day";
}

export default async function CaissesPage({ searchParams }: CaissesPageProps) {
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

  const data = await listAdminCashSessions(workspace, {
    from: periodRange.from,
    to: periodRange.to,
  });

  return (
    <AdminCashSessionsWorkspace
      {...data}
      establishmentName={workspace.establishmentName}
      periodFilter={periodFilter}
      periodFrom={periodRange.from}
      periodTo={periodRange.to}
    />
  );
}
