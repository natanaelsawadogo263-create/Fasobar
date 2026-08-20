import { Suspense } from "react";

import { KitchenWorkspace } from "@/components/kitchen/kitchen-workspace";
import { PageLoadingShell } from "@/components/layout/page-loading-shell";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { listKitchenOrders } from "@/lib/kitchen/queries";

async function CuisineContent({ workspace }: { workspace: WorkspaceContext }) {
  const orders = await listKitchenOrders(workspace);

  return (
    <KitchenWorkspace orders={orders} establishmentId={workspace.establishmentId} />
  );
}

export function CuisineSuspense({ workspace }: { workspace: WorkspaceContext }) {
  return (
    <Suspense fallback={<PageLoadingShell label="Cuisine…" />}>
      <CuisineContent workspace={workspace} />
    </Suspense>
  );
}
