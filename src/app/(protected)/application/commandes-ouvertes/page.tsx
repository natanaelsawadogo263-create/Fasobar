import { OpenOrdersWorkspace } from "@/components/cashier/open-orders-workspace";
import { isEcommerceActivity } from "@/lib/auth/activities";
import { requireOrderReadContext } from "@/lib/auth/workspace-context";
import { deliveryOrderStage } from "@/lib/delivery/constants";
import { listDeliveryOrders } from "@/lib/delivery/queries";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { getCashierServiceDayStartIso, listCashierOrders } from "@/lib/orders/queries";
import { getActiveCashSession } from "@/lib/payments/queries";

/** Livraisons à suivre : toutes celles en cours ou à encaisser, plus celles terminées aujourd'hui. */
function relevantDeliveries(orders: DeliveryOrder[]): DeliveryOrder[] {
  const dayStart = getCashierServiceDayStartIso();
  return orders.filter((order) => {
    const stage = deliveryOrderStage(order);
    if (stage === "PENDING" || stage === "ACCEPTED" || stage === "TO_CASH") return true;
    const finishedAt = order.cashedAt ?? order.cancelledAt ?? order.createdAt;
    return finishedAt >= dayStart;
  });
}

export default async function CommandesOuvertesPage() {
  const workspace = await requireOrderReadContext();
  const sessionPromise = workspace.canManageOrders
    ? getActiveCashSession(workspace)
    : Promise.resolve(null);
  const ecommerce = isEcommerceActivity(workspace.activityCode);

  const [session, orders, deliveries] = await Promise.all([
    sessionPromise,
    listCashierOrders(workspace, {
      includeFinalized: true,
      sessionOpenedAt: null,
    }),
    // Chaque caisse ne suit que les livraisons qu'elle a envoyées.
    ecommerce
      ? listDeliveryOrders(workspace, { createdBy: workspace.userId, limit: 150 })
      : Promise.resolve(null),
  ]);

  return (
    <OpenOrdersWorkspace
      establishmentName={workspace.establishmentName}
      orders={orders}
      canManageOrders={workspace.canManageOrders}
      canOperateCashRegister={workspace.canOperateCashRegister}
      establishmentId={workspace.establishmentId}
      deliveries={deliveries ? relevantDeliveries(deliveries) : undefined}
    />
  );
}
