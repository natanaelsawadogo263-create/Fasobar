import { Suspense } from "react";

import { CashierWorkspace } from "@/components/cashier/cashier-workspace";
import { PageLoadingShell } from "@/components/layout/page-loading-shell";
import { getCaissePageData } from "@/lib/caisse/page-data";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";

type CaissePageContentProps = {
  workspace: WorkspaceContext;
  params: { order?: string; fresh?: string; t?: string };
};

async function CaissePageContent({ workspace, params }: CaissePageContentProps) {
  const data = await getCaissePageData(workspace, params);

  return (
    <CashierWorkspace
      key={
        data.freshCart
          ? `fresh-${params.t ?? "1"}`
          : (params.order ?? "new")
      }
      cashierName={workspace.ownerName}
      categories={data.categories}
      products={data.products}
      openOrders={data.openOrders}
      session={data.session}
      initialOrder={data.initialOrder}
      freshCart={data.freshCart}
      serviceScope={workspace.serviceScope}
      activityCode={workspace.activityCode}
      canManageProducts={workspace.canManageProducts}
      establishmentId={workspace.establishmentId}
    />
  );
}

export { CaissePageContent };

export function CaissePageSuspense({
  workspace,
  params,
}: CaissePageContentProps) {
  return (
    <Suspense fallback={<PageLoadingShell label="Ouverture de la caisse…" />}>
      <CaissePageContent workspace={workspace} params={params} />
    </Suspense>
  );
}
