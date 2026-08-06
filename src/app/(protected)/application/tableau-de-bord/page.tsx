import { AdminDashboardWorkspace } from "@/components/admin/admin-dashboard-workspace";
import { getAdminDashboardData } from "@/lib/admin/dashboard-queries";
import { requireAdminContext } from "@/lib/auth/workspace-context";

export default async function TableauDeBordPage() {
  const workspace = await requireAdminContext();
  const data = await getAdminDashboardData(workspace);

  return <AdminDashboardWorkspace data={data} />;
}
