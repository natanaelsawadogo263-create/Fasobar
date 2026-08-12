import { AdminDashboardWorkspace } from "@/components/admin/admin-dashboard-workspace";
import { AdminShell } from "@/components/admin/admin-shell";
import { getMockAdminDashboardData } from "@/lib/admin/dashboard-mock";
import { ADMIN_NAV } from "@/lib/navigation/space-navigation";

/** Preview visuelle 1366×768 — hors auth, à retirer après validation. */
export default function AdminDashboardPreviewPage() {
  return (
    <AdminShell
      establishmentId="preview"
      establishmentName="Le Faso Bar Ouaga 2000"
      organizationName="FasoBar"
      adminName="Admin Faso"
      navItems={ADMIN_NAV}
    >
      <AdminDashboardWorkspace data={getMockAdminDashboardData()} />
    </AdminShell>
  );
}
