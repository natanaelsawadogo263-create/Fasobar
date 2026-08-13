import { requireAdminContext } from "@/lib/auth/workspace-context";
import { listAdminCashSessions } from "@/lib/admin/cash-sessions-queries";
import { AdminCashSessionsWorkspace } from "@/components/admin/admin-cash-sessions-workspace";

export default async function CaissesPage() {
  const workspace = await requireAdminContext();
  const data = await listAdminCashSessions(workspace);

  return (
    <AdminCashSessionsWorkspace
      {...data}
      establishmentName={workspace.establishmentName}
      activityCode={workspace.activityCode}
    />
  );
}
