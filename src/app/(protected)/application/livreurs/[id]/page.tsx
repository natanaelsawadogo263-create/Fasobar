import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CourierDetailWorkspace } from "@/components/delivery/courier-detail-workspace";
import { requireDeliveryManagerContext } from "@/lib/auth/workspace-context";
import { resolveDeliveryPeriod } from "@/lib/delivery/period";
import {
  getCourierPeriodReport,
  getCourierStock,
  listCourierMovements,
  listDeliveryOrders,
  listDeliveryProducts,
} from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

export const metadata: Metadata = {
  title: "Livreur",
};

type LivreurDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LivreurDetailPage({ params, searchParams }: LivreurDetailPageProps) {
  const { id } = await params;
  await requireCloudOnlineForDesktop(`/application/livreurs/${id}`);
  const workspace = await requireDeliveryManagerContext();
  const period = resolveDeliveryPeriod(await searchParams);

  // Ne liste que les livreurs de l'établissement courant : un id étranger → 404.
  const report = await getCourierPeriodReport(workspace, period, id);
  const courier = report.couriers[0];
  if (!courier) {
    notFound();
  }

  const [stock, movements, inProgress, delivered, products] = await Promise.all([
    getCourierStock(workspace, courier.id),
    listCourierMovements(workspace, courier.id, 500, period),
    listDeliveryOrders(workspace, {
      statuses: ["ACCEPTED"],
      courierId: courier.id,
      limit: 100,
    }),
    listDeliveryOrders(workspace, {
      statuses: ["DELIVERED"],
      courierId: courier.id,
      deliveredSince: period.start.toISOString(),
      deliveredBefore: period.end.toISOString(),
      orderBy: "delivered_at",
      limit: 500,
    }),
    listDeliveryProducts(workspace),
  ]);

  return (
    <CourierDetailWorkspace
      establishmentId={workspace.establishmentId}
      courier={courier}
      daily={report.daily}
      period={{ preset: period.preset, from: period.from, to: period.to }}
      stock={stock}
      movements={movements}
      orders={[...inProgress, ...delivered]}
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
