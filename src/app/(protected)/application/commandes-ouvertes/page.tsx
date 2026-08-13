import { OpenOrdersWorkspace } from "@/components/cashier/open-orders-workspace";
import { requireOrderReadContext } from "@/lib/auth/workspace-context";
import { listCashierOrders } from "@/lib/orders/queries";
import { getActiveCashSession } from "@/lib/payments/queries";

export default async function CommandesOuvertesPage() {
  const workspace = await requireOrderReadContext();
  const session = workspace.canManageOrders
    ? await getActiveCashSession(workspace)
    : null;
  const orders = await listCashierOrders(workspace, {
    includeFinalized: true,
    sessionOpenedAt: session?.openedAt ?? null,
  });

  return (
    <OpenOrdersWorkspace
      establishmentName={workspace.establishmentName}
      orders={orders}
      canManageOrders={workspace.canManageOrders}
      canOperateCashRegister={workspace.canOperateCashRegister}
      activityCode={workspace.activityCode}
    />
  );
}
