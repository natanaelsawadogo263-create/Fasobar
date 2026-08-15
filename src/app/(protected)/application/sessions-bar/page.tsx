import { redirect } from "next/navigation";

import { requireAdminContext } from "@/lib/auth/workspace-context";
import { hasBarService } from "@/lib/settings/service-scope";
import { listAdminBarSessions } from "@/lib/admin/bar-sessions-queries";
import { AdminBarSessionsWorkspace } from "@/components/admin/admin-bar-sessions-workspace";
import {
  resolveOrderPeriodRange,
  toLocalIsoDate,
} from "@/lib/orders/period";

type AdminBarSessionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type SessionsPeriod = "day" | "week" | "month" | "custom";

function parsePeriod(value: string | undefined, hasCustomDates: boolean): SessionsPeriod {
  if (value === "week" || value === "month" || value === "day" || value === "custom") {
    return value;
  }
  return hasCustomDates ? "custom" : "day";
}

export default async function AdminBarSessionsPage({
  searchParams,
}: AdminBarSessionsPageProps) {
  const workspace = await requireAdminContext();

  if (!hasBarService(workspace.serviceScope)) {
    redirect("/application/tableau-de-bord");
  }

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

  const data = await listAdminBarSessions(workspace, {
    from: periodRange.from,
    to: periodRange.to,
  });

  return (
    <AdminBarSessionsWorkspace
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
