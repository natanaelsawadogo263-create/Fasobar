import { redirect } from "next/navigation";

import { BarDashboardSuspense } from "@/app/(protected)/application/bar/bar-dashboard-content";
import { requireBarManagerContext } from "@/lib/auth/workspace-context";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";

export default async function BarDashboardPage() {
  const workspace = await requireBarManagerContext();

  if (
    !isPathAllowedForSpace(
      "/application/bar",
      workspace.userSpace,
      workspace.serviceScope,
      workspace.activityCode,
    )
  ) {
    redirect("/application/acces-refuse");
  }

  return <BarDashboardSuspense workspace={workspace} />;
}
