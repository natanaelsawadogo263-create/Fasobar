import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CourierWorkspace } from "@/components/delivery/courier-workspace";
import { requireDeliveryCourierContext } from "@/lib/auth/workspace-context";
import { getCourierStock, listDeliveryOrders } from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

export const metadata: Metadata = {
  title: "Commandes à prendre",
};

type LivreurPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export default async function LivreurPage({ searchParams }: LivreurPageProps) {
  const params = await searchParams;
  // Anciens liens (onglets) : l'historique a désormais sa propre page.
  if (params.onglet === "historique") {
    const periode = typeof params.periode === "string" ? params.periode : undefined;
    redirect(`/application/livreur/historique${periode ? `?periode=${encodeURIComponent(periode)}` : ""}`);
  }

  await requireCloudOnlineForDesktop("/application/livreur");
  const workspace = await requireDeliveryCourierContext();

  const [availableOrders, myOrders, deliveredToday, toRemit, stock] = await Promise.all([
    listDeliveryOrders(workspace, { statuses: ["PENDING"], limit: 100 }),
    listDeliveryOrders(workspace, {
      statuses: ["ACCEPTED"],
      courierId: workspace.userId,
      limit: 100,
    }),
    listDeliveryOrders(workspace, {
      statuses: ["DELIVERED"],
      courierId: workspace.userId,
      deliveredSince: startOfToday().toISOString(),
      orderBy: "delivered_at",
      limit: 500,
    }),
    // Livrées mais pas encore encaissées par la caisse : argent à remettre.
    listDeliveryOrders(workspace, {
      statuses: ["DELIVERED"],
      courierId: workspace.userId,
      cashed: false,
      limit: 500,
    }),
    getCourierStock(workspace, workspace.userId),
  ]);

  return (
    <CourierWorkspace
      courierName={workspace.ownerName}
      availableOrders={[...availableOrders].reverse()}
      inProgressCount={myOrders.length}
      toCollectValue={myOrders.reduce((sum, order) => sum + order.totalAmount, 0)}
      deliveredTodayCount={deliveredToday.length}
      toRemitCount={toRemit.length}
      toRemitValue={toRemit.reduce((sum, order) => sum + order.totalAmount, 0)}
      stock={stock}
    />
  );
}
