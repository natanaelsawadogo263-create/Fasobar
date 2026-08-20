import { Suspense } from "react";

import { AdminSalesWorkspace } from "@/components/admin/admin-sales-workspace";
import { PageLoadingShell } from "@/components/layout/page-loading-shell";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { listOrderCashiers } from "@/lib/orders/queries";
import { getAdminSalesData } from "@/lib/sales/queries";
import type { SalesFiltersInput } from "@/lib/sales/schemas";

type VentesPageContentProps = {
  workspace: WorkspaceContext;
  filters: SalesFiltersInput;
};

async function VentesPageContent({
  workspace,
  filters,
}: VentesPageContentProps) {
  const [data, cashiers] = await Promise.all([
    getAdminSalesData(workspace, filters),
    listOrderCashiers(workspace),
  ]);

  return (
    <AdminSalesWorkspace
      data={data}
      filters={filters}
      cashiers={cashiers}
      establishmentName={workspace.establishmentName}
      serviceScope={workspace.serviceScope}
      activityCode={workspace.activityCode}
    />
  );
}

export function VentesPageSuspense(props: VentesPageContentProps) {
  return (
    <Suspense fallback={<PageLoadingShell label="Chargement des ventes…" />}>
      <VentesPageContent {...props} />
    </Suspense>
  );
}
