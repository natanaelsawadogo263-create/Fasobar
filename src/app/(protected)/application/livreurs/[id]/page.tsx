import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CourierDetailWorkspace } from "@/components/delivery/courier-detail-workspace";
import { requireDeliveryManagerContext } from "@/lib/auth/workspace-context";
import {
  getCourierStock,
  listCourierMovements,
  listCourierSummaries,
  listDeliveryOrders,
  listDeliveryProducts,
} from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

export const metadata: Metadata = {
  title: "Livreur",
};

type LivreurDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LivreurDetailPage({ params }: LivreurDetailPageProps) {
  const { id } = await params;
  await requireCloudOnlineForDesktop(`/application/livreurs/${id}`);
  const workspace = await requireDeliveryManagerContext();

  // Ne liste que les livreurs de l'établissement courant : un id étranger → 404.
  const couriers = await listCourierSummaries(workspace);
  const courier = couriers.find((item) => item.id === id);
  if (!courier) {
    notFound();
  }

  const [stock, movements, orders, products] = await Promise.all([
    getCourierStock(workspace, courier.id),
    listCourierMovements(workspace, courier.id),
    listDeliveryOrders(workspace, {
      statuses: ["ACCEPTED", "DELIVERED"],
      courierId: courier.id,
      limit: 100,
    }),
    listDeliveryProducts(workspace),
  ]);

  return (
    <CourierDetailWorkspace
      establishmentId={workspace.establishmentId}
      courier={courier}
      stock={stock}
      movements={movements}
      orders={orders}
      allocateOptions={products
        .filter((product) => product.stockQuantity > 0)
        .map((product) => ({
          productId: product.id,
          name: product.name,
          available: product.stockQuantity,
        }))}
    />
  );
}
