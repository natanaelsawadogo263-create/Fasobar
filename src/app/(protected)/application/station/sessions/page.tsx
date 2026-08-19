import { StationPumpSessionsWorkspace } from "@/components/station/station-pump-sessions-workspace";
import { requireGasStationAdminContext } from "@/lib/auth/workspace-context";
import { listAdminStationPumpSessions } from "@/lib/admin/station-sessions-queries";
import { resolveOrderPeriodRange, toLocalIsoDate } from "@/lib/orders/period";

type SessionsPeriod = "day" | "week" | "month";

type StationSessionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePeriod(value: string | undefined): SessionsPeriod {
  if (value === "week" || value === "month" || value === "day") return value;
  return "day";
}

export default async function StationSessionsPage({
  searchParams,
}: StationSessionsPageProps) {
  const workspace = await requireGasStationAdminContext();

  const raw = await searchParams;
  const periodFilter = parsePeriod(typeof raw.period === "string" ? raw.period : undefined);
  const periodRange =
    typeof raw.from === "string" && typeof raw.to === "string"
      ? { from: raw.from, to: raw.to }
      : resolveOrderPeriodRange(
          periodFilter,
          typeof raw.anchor === "string" ? raw.anchor : toLocalIsoDate(new Date()),
        );

  const data = await listAdminStationPumpSessions(workspace, {
    from: periodRange.from,
    to: periodRange.to,
  });

  return (
    <StationPumpSessionsWorkspace
      sessions={data.sessions}
      openCount={data.openCount}
      closedCount={data.closedCount}
      establishmentName={workspace.establishmentName}
      periodFilter={periodFilter}
      periodFrom={periodRange.from}
      periodTo={periodRange.to}
    />
  );
}
