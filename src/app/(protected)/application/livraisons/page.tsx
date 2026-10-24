import type { Metadata } from "next";

import { DeliveryDeskWorkspace } from "@/components/delivery/delivery-desk-workspace";
import { requireDeliveryOrderDeskContext } from "@/lib/auth/workspace-context";
import { listDeliveryOrders, listDeliveryProducts } from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

export const metadata: Metadata = {
  title: "Livraisons",
};

export default async function LivraisonsPage() {
  await requireCloudOnlineForDesktop("/application/livraisons");
  const workspace = await requireDeliveryOrderDeskContext();

  const [products, orders] = await Promise.all([
    listDeliveryProducts(workspace),
    listDeliveryOrders(workspace, { limit: 150 }),
  ]);

  return (
    <DeliveryDeskWorkspace
      establishmentId={workspace.establishmentId}
      products={products}
      orders={orders}
    />
  );
}
