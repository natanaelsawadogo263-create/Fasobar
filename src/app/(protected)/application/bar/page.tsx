import { redirect } from "next/navigation";

import { BarDashboardWorkspace } from "@/components/bar/bar-dashboard-workspace";
import { BarSessionGate } from "@/components/bar/bar-session-gate";
import { requireBarManagerContext } from "@/lib/auth/workspace-context";
import { getBarDashboardData } from "@/lib/bar/queries";
import { getBarSessionContext } from "@/lib/bar/session-queries";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";

export default async function BarDashboardPage() {
  const workspace = await requireBarManagerContext();

  if (!isPathAllowedForSpace("/application/bar", workspace.userSpace)) {
    redirect("/application/acces-refuse");
  }

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
