import type { Metadata } from "next";

import { CourierInProgress } from "@/components/delivery/courier-in-progress";
import { requireDeliveryCourierContext } from "@/lib/auth/workspace-context";
import { listDeliveryOrders } from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

export const metadata: Metadata = {
  title: "Livraisons en cours",
};

export default async function LivreurEnCoursPage() {
  await requireCloudOnlineForDesktop("/application/livreur/en-cours");
  const workspace = await requireDeliveryCourierContext();

  const orders = await listDeliveryOrders(workspace, {
    statuses: ["ACCEPTED"],
    courierId: workspace.userId,
    limit: 100,
  });

  return <CourierInProgress orders={orders} />;
}
