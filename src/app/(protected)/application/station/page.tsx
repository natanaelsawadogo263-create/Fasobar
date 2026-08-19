import type { Metadata } from "next";

import { StationAdminDashboardWorkspace } from "@/components/station/station-admin-dashboard-workspace";
import {
  getStationDashboardData,
  type StationDashboardPeriod,
} from "@/lib/admin/station-dashboard-queries";
import { requireGasStationAdminContext } from "@/lib/auth/workspace-context";

export const metadata: Metadata = {
  title: "Tableau de bord — Station",
};

type StationDashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePeriod(raw: string | string[] | undefined): StationDashboardPeriod {
  const value = typeof raw === "string" ? raw : "day";
  if (value === "week" || value === "month") return value;
  return "day";
}

export default async function StationDashboardPage({
  searchParams,
}: StationDashboardPageProps) {
  const workspace = await requireGasStationAdminContext();
  const params = await searchParams;
  const period = parsePeriod(params.period);
  const data = await getStationDashboardData(workspace, { period });

  return <StationAdminDashboardWorkspace data={data} />;
}
