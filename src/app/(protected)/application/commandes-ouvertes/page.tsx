import { OpenOrdersWorkspace } from "@/components/cashier/open-orders-workspace";
import { requireOrderReadContext } from "@/lib/auth/workspace-context";
import { listCashierOrders } from "@/lib/orders/queries";
import { getActiveCashSession } from "@/lib/payments/queries";

export default async function CommandesOuvertesPage() {
  const workspace = await requireOrderReadContext();
  const sessionPromise = workspace.canManageOrders
    ? getActiveCashSession(workspace)
    : Promise.resolve(null);

  const [session, orders] = await Promise.all([
    sessionPromise,
    listCashierOrders(workspace, {
      includeFinalized: true,
      sessionOpenedAt: null,
    }),
  ]);

  return (
    <OpenOrdersWorkspace
      establishmentName={workspace.establishmentName}
      orders={orders}
      canManageOrders={workspace.canManageOrders}
      canOperateCashRegister={workspace.canOperateCashRegister}
    />
  );
}
