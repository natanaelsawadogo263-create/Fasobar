import { redirect } from "next/navigation";

import { requireAdminContext } from "@/lib/auth/workspace-context";
import { hasBarService } from "@/lib/settings/service-scope";
import { listAdminBarSessions } from "@/lib/admin/bar-sessions-queries";
import { AdminBarSessionsWorkspace } from "@/components/admin/admin-bar-sessions-workspace";

export default async function AdminBarSessionsPage() {
  const workspace = await requireAdminContext();

  if (!hasBarService(workspace.serviceScope)) {
    redirect("/application/tableau-de-bord");
  }

  const data = await listAdminBarSessions(workspace);

  return (
    <AdminBarSessionsWorkspace
      sessions={data.sessions}
      openCount={data.openCount}
      closedCount={data.closedCount}
      establishmentName={workspace.establishmentName}
    />
  );
}
