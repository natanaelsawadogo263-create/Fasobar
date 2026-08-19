import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PompisteDashboardWorkspace } from "@/components/station/pompiste-dashboard-workspace";
import { requireGasStationOperatorContext } from "@/lib/auth/workspace-context";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";
import { getPompisteDashboardData } from "@/lib/station/pompiste-dashboard-queries";

export const metadata: Metadata = {
  title: "Ma pompe — Pompiste",
};

export default async function PompisteDashboardPage() {
  const workspace = await requireGasStationOperatorContext();

  if (
    !isPathAllowedForSpace(
      "/application/station/pompiste",
      workspace.userSpace,
      workspace.serviceScope,
      workspace.activityCode,
    )
  ) {
    redirect("/application/acces-refuse");
  }

  const data = await getPompisteDashboardData(workspace);

  return <PompisteDashboardWorkspace data={data} />;
}
