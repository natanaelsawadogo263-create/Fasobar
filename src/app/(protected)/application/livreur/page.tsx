import type { Metadata } from "next";

import { CourierWorkspace } from "@/components/delivery/courier-workspace";
import { requireDeliveryCourierContext } from "@/lib/auth/workspace-context";
import { getCourierStock, listDeliveryOrders } from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

export const metadata: Metadata = {
  title: "Mes livraisons",
};

function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

export default async function LivreurPage() {
  await requireCloudOnlineForDesktop("/application/livreur");
  const workspace = await requireDeliveryCourierContext();

  const [availableOrders, myOrders, myDelivered, stock] = await Promise.all([
    listDeliveryOrders(workspace, { statuses: ["PENDING"], limit: 100 }),
    listDeliveryOrders(workspace, {
      statuses: ["ACCEPTED"],
      courierId: workspace.userId,
      limit: 100,
    }),
    listDeliveryOrders(workspace, {
      statuses: ["DELIVERED"],
      courierId: workspace.userId,
      limit: 100,
    }),
    getCourierStock(workspace, workspace.userId),
  ]);

  const today = startOfToday();
  const deliveredToday = myDelivered.filter(
    (order) => order.deliveredAt && new Date(order.deliveredAt).getTime() >= today,
  );

  return (
    <CourierWorkspace
      establishmentId={workspace.establishmentId}
      courierName={workspace.ownerName}
      availableOrders={[...availableOrders].reverse()}
      myOrders={myOrders}
      deliveredToday={deliveredToday}
      stock={stock}
    />
  );
}
