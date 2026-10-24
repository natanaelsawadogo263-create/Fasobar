import type { Metadata } from "next";

import { CourierHistory } from "@/components/delivery/courier-history";
import { requireDeliveryCourierContext } from "@/lib/auth/workspace-context";
import {
  COURIER_HISTORY_LIMIT,
  courierHistoryStart,
  parseCourierHistoryPeriod,
} from "@/lib/delivery/constants";
import { listDeliveryOrders } from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

export const metadata: Metadata = {
  title: "Historique des livraisons",
};

type LivreurHistoriquePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LivreurHistoriquePage({ searchParams }: LivreurHistoriquePageProps) {
  await requireCloudOnlineForDesktop("/application/livreur/historique");
  const workspace = await requireDeliveryCourierContext();
  const params = await searchParams;

  const period = parseCourierHistoryPeriod(params.periode);
  const history = await listDeliveryOrders(workspace, {
    statuses: ["DELIVERED"],
    courierId: workspace.userId,
    deliveredSince: courierHistoryStart(period).toISOString(),
    orderBy: "delivered_at",
    limit: COURIER_HISTORY_LIMIT,
  });

  return (
    <CourierHistory
      history={history}
      period={period}
      limitReached={history.length >= COURIER_HISTORY_LIMIT}
    />
  );
}
