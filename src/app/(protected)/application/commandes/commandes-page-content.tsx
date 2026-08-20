import { Suspense } from "react";

import { AdminOrdersWorkspace } from "@/components/admin/admin-orders-workspace";
import { PageLoadingShell } from "@/components/layout/page-loading-shell";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import {
  formatOrderPeriodLabel,
  resolveOrderPeriodRange,
  toLocalIsoDate,
} from "@/lib/orders/period";
import { listAdminOrders, listOrderCashiers } from "@/lib/orders/queries";
import type { AdminOrderFiltersInput } from "@/lib/orders/schemas";

type CommandesPageContentProps = {
  workspace: WorkspaceContext;
  filters: AdminOrderFiltersInput;
};

async function CommandesPageContent({
  workspace,
  filters,
}: CommandesPageContentProps) {
  const [data, cashiers] = await Promise.all([
    listAdminOrders(workspace, filters),
    listOrderCashiers(workspace),
  ]);

  return (
    <AdminOrdersWorkspace
      {...data}
      filters={filters}
      periodLabel={formatOrderPeriodLabel(
        filters.period ?? "day",
        filters.from,
        filters.to,
      )}
      cashiers={cashiers}
      establishmentName={workspace.establishmentName}
      canManageOrders={workspace.canManageOrders}
      serviceScope={workspace.serviceScope}
    />
  );
}

export function CommandesPageSuspense(props: CommandesPageContentProps) {
  return (
    <Suspense fallback={<PageLoadingShell label="Chargement des commandes…" />}>
      <CommandesPageContent {...props} />
    </Suspense>
  );
}
