import type { Metadata } from "next";

import { StationDashboardSuspense } from "@/app/(protected)/application/station/station-dashboard-content";
import { requireGasStationAdminContext } from "@/lib/auth/workspace-context";
import type { StationDashboardPeriod } from "@/lib/admin/station-dashboard-queries";

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
  const [workspace, params] = await Promise.all([
    requireGasStationAdminContext(),
    searchParams,
  ]);

  return (
    <StationDashboardSuspense
      workspace={workspace}
      period={parsePeriod(params.period)}
    />
  );
}
