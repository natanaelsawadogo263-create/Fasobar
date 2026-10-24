import type { Metadata } from "next";

import { CourierWorkspace } from "@/components/delivery/courier-workspace";
import { requireDeliveryCourierContext } from "@/lib/auth/workspace-context";
import {
  COURIER_HISTORY_LIMIT,
  courierHistoryStart,
  parseCourierHistoryPeriod,
} from "@/lib/delivery/constants";
import {
  getCourierStock,
  listCourierMovements,
  listDeliveryOrders,
} from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

export const metadata: Metadata = {
  title: "Mes livraisons",
};

type LivreurPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

export default async function LivreurPage({ searchParams }: LivreurPageProps) {
  await requireCloudOnlineForDesktop("/application/livreur");
  const workspace = await requireDeliveryCourierContext();
  const params = await searchParams;

  const historyPeriod = parseCourierHistoryPeriod(params.periode);
  const initialTab = params.onglet === "historique" ? "history" : undefined;

  const [availableOrders, myOrders, history, stock, movements] = await Promise.all([
    listDeliveryOrders(workspace, { statuses: ["PENDING"], limit: 100 }),
    listDeliveryOrders(workspace, {
      statuses: ["ACCEPTED"],
      courierId: workspace.userId,
      limit: 100,
    }),
    listDeliveryOrders(workspace, {
      statuses: ["DELIVERED"],
      courierId: workspace.userId,
      deliveredSince: courierHistoryStart(historyPeriod).toISOString(),
      orderBy: "delivered_at",
      limit: COURIER_HISTORY_LIMIT,
    }),
    getCourierStock(workspace, workspace.userId),
    listCourierMovements(workspace, workspace.userId, 30),
  ]);

  // Toutes les périodes incluent aujourd'hui : le compteur du jour en découle.
  const today = startOfToday();
  const deliveredToday = history.filter(
    (order) => order.deliveredAt && new Date(order.deliveredAt).getTime() >= today,
  );

  return (
    <CourierWorkspace
      establishmentId={workspace.establishmentId}
      courierName={workspace.ownerName}
      availableOrders={[...availableOrders].reverse()}
      myOrders={myOrders}
      deliveredToday={deliveredToday}
      history={history}
      historyPeriod={historyPeriod}
      historyLimitReached={history.length >= COURIER_HISTORY_LIMIT}
      initialTab={initialTab}
      stock={stock}
      movements={movements}
    />
  );
}
