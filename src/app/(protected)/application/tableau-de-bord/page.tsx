import { redirect } from "next/navigation";

import { AdminDashboardWorkspace } from "@/components/admin/admin-dashboard-workspace";
import {
  getAdminDashboardData,
  type AdminDashboardPeriod,
} from "@/lib/admin/dashboard-queries";
import { requireAdminContext } from "@/lib/auth/workspace-context";

type TableauDeBordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePeriod(raw: string | string[] | undefined): AdminDashboardPeriod {
  const value = typeof raw === "string" ? raw : "day";
  if (value === "week" || value === "month") return value;
  return "day";
}

export default async function TableauDeBordPage({
  searchParams,
}: TableauDeBordPageProps) {
  const workspace = await requireAdminContext();

  if (workspace.activityCode === "gas_station") {
    redirect("/application/station");
  }

  const params = await searchParams;
  const period = parsePeriod(params.period);
  const data = await getAdminDashboardData(workspace, { period });

  return (
    <AdminDashboardWorkspace
      data={data}
      serviceScope={workspace.serviceScope}
      activityCode={workspace.activityCode}
    />
  );
}
