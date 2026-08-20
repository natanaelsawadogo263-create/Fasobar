import { DashboardSuspense } from "@/app/(protected)/application/tableau-de-bord/dashboard-content";
import { requireAdminContext } from "@/lib/auth/workspace-context";
import type { AdminDashboardPeriod } from "@/lib/admin/dashboard-queries";
import { redirect } from "next/navigation";

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
  const [workspace, params] = await Promise.all([
    requireAdminContext(),
    searchParams,
  ]);

  if (workspace.activityCode === "gas_station") {
    redirect("/application/station");
  }

  return (
    <DashboardSuspense
      workspace={workspace}
      period={parsePeriod(params.period)}
    />
  );
}
