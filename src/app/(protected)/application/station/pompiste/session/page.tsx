import type { Metadata } from "next";

import { PompisteSessionWorkspace } from "@/components/station/pompiste-session-workspace";
import { requireGasStationOperatorContext } from "@/lib/auth/workspace-context";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";
import { getPompisteSessionPageData } from "@/lib/station/pump-session-queries";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Ma session — Pompiste",
};

export default async function PompisteSessionPage() {
  const workspace = await requireGasStationOperatorContext();

  if (
    !isPathAllowedForSpace(
      "/application/station/pompiste/session",
      workspace.userSpace,
      workspace.serviceScope,
      workspace.activityCode,
    )
  ) {
    redirect("/application/acces-refuse");
  }

  const data = await getPompisteSessionPageData(workspace);

  const otherOpenSessionsByPump: Record<
    string,
    { fuelPumpId: string; openedAt: string; openedByName: string | null }
  > = {};
  for (const session of data.otherOpenSessions) {
    otherOpenSessionsByPump[session.fuelPumpId] = {
      fuelPumpId: session.fuelPumpId,
      openedAt: session.openedAt,
      openedByName: session.openedByName,
    };
  }

  return (
    <PompisteSessionWorkspace
      ownSession={data.ownSession}
      pumps={data.pumps}
      otherOpenSessionsByPump={otherOpenSessionsByPump}
      lastClosedIndexEndByPump={data.lastClosedIndexEndByPump}
      sheetBootstrap={data.sheetBootstrap}
      stationName={workspace.establishmentName ?? "Station"}
      stationLogoUrl={data.settings.settings?.logoUrl ?? null}
      operatorName={workspace.ownerName}
    />
  );
}
