import type { Metadata } from "next";

import { DeliveryDeskWorkspace } from "@/components/delivery/delivery-desk-workspace";
import { requireDeliveryOrderDeskContext } from "@/lib/auth/workspace-context";
import { listDeliveryOrders, listDeliveryProducts } from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";
import { getActiveCashSession } from "@/lib/payments/queries";

export const metadata: Metadata = {
  title: "Livraisons",
};

export default async function LivraisonsPage() {
  await requireCloudOnlineForDesktop("/application/livraisons");
  const workspace = await requireDeliveryOrderDeskContext();

  const [products, recentOrders, toCashOrders, cashSession] = await Promise.all([
    listDeliveryProducts(workspace),
    listDeliveryOrders(workspace, { limit: 150 }),
    // Toutes les livrées non encaissées, même anciennes : rien ne doit être oublié.
    listDeliveryOrders(workspace, {
      statuses: ["DELIVERED"],
      cashed: false,
      orderBy: "delivered_at",
      limit: 500,
    }),
    getActiveCashSession(workspace),
  ]);

  const recentIds = new Set(recentOrders.map((order) => order.id));
  const orders = [
    ...recentOrders,
    ...toCashOrders.filter((order) => !recentIds.has(order.id)),
  ];

  return (
    <DeliveryDeskWorkspace
      establishmentId={workspace.establishmentId}
      products={products}
      orders={orders}
      hasOpenCashSession={cashSession !== null}
    />
  );
}
