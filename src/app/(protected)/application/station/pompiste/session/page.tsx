import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PompisteSessionSuspense } from "@/app/(protected)/application/station/pompiste/session/session-content";
import { requireGasStationOperatorContext } from "@/lib/auth/workspace-context";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";

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

  return <PompisteSessionSuspense workspace={workspace} />;
}
