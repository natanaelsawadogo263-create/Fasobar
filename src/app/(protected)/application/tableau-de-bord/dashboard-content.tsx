import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AdminDashboardWorkspace } from "@/components/admin/admin-dashboard-workspace";
import { PageLoadingShell } from "@/components/layout/page-loading-shell";
import {
  getAdminDashboardData,
  type AdminDashboardPeriod,
} from "@/lib/admin/dashboard-queries";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";

type DashboardContentProps = {
  workspace: WorkspaceContext;
  period: AdminDashboardPeriod;
};

async function DashboardContent({ workspace, period }: DashboardContentProps) {
  const data = await getAdminDashboardData(workspace, { period });

  return (
    <AdminDashboardWorkspace
      data={data}
      serviceScope={workspace.serviceScope}
      activityCode={workspace.activityCode}
    />
  );
}

export function DashboardSuspense({ workspace, period }: DashboardContentProps) {
  return (
    <Suspense fallback={<PageLoadingShell label="Tableau de bord…" />}>
      <DashboardContent workspace={workspace} period={period} />
    </Suspense>
  );
}

export { DashboardContent };
