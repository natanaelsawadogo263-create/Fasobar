import { Suspense } from "react";

import { PompisteSessionWorkspace } from "@/components/station/pompiste-session-workspace";
import { PageLoadingShell } from "@/components/layout/page-loading-shell";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { getPompisteSessionPageData } from "@/lib/station/pump-session-queries";

async function PompisteSessionContent({ workspace }: { workspace: WorkspaceContext }) {
  const data = await getPompisteSessionPageData(workspace);

  return (
    <PompisteSessionWorkspace
      ownSession={data.ownSession}
      sheetBootstrap={data.sheetBootstrap}
      prices={data.prices}
      stationName={workspace.establishmentName ?? "Station"}
      operatorName={workspace.ownerName}
    />
  );
}

export function PompisteSessionSuspense({ workspace }: { workspace: WorkspaceContext }) {
  return (
    <Suspense fallback={<PageLoadingShell label="Ma session…" />}>
      <PompisteSessionContent workspace={workspace} />
    </Suspense>
  );
}
