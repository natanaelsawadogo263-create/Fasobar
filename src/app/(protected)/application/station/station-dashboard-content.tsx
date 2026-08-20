import { Suspense } from "react";

import { StationAdminDashboardWorkspace } from "@/components/station/station-admin-dashboard-workspace";
import { PageLoadingShell } from "@/components/layout/page-loading-shell";
import {
  getStationDashboardData,
  type StationDashboardPeriod,
} from "@/lib/admin/station-dashboard-queries";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";

async function StationDashboardContent({
  workspace,
  period,
}: {
  workspace: WorkspaceContext;
  period: StationDashboardPeriod;
}) {
  const data = await getStationDashboardData(workspace, { period });
  return <StationAdminDashboardWorkspace data={data} />;
}

export function StationDashboardSuspense({
  workspace,
  period,
}: {
  workspace: WorkspaceContext;
  period: StationDashboardPeriod;
}) {
  return (
    <Suspense fallback={<PageLoadingShell label="Station…" />}>
      <StationDashboardContent workspace={workspace} period={period} />
    </Suspense>
  );
}
