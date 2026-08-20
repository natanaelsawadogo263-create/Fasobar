import { Suspense } from "react";

import { BarDashboardWorkspace } from "@/components/bar/bar-dashboard-workspace";
import { BarSessionGate } from "@/components/bar/bar-session-gate";
import { PageLoadingShell } from "@/components/layout/page-loading-shell";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { getBarDashboardData } from "@/lib/bar/queries";
import { getBarSessionContext } from "@/lib/bar/session-queries";

type BarDashboardContentProps = {
  workspace: WorkspaceContext;
};

async function BarDashboardContent({ workspace }: BarDashboardContentProps) {
  const [{ openSession }, data] = await Promise.all([
    getBarSessionContext(workspace),
    getBarDashboardData(workspace),
  ]);

  return (
    <BarSessionGate
      openSession={openSession}
      managerName={workspace.ownerName}
      requireSession={false}
      showBanner={false}
    >
      <BarDashboardWorkspace
        data={data}
        openSession={openSession}
        managerName={workspace.ownerName}
      />
    </BarSessionGate>
  );
}

export function BarDashboardSuspense(props: BarDashboardContentProps) {
  return (
    <Suspense fallback={<PageLoadingShell label="Ouverture du bar…" />}>
      <BarDashboardContent {...props} />
    </Suspense>
  );
}
