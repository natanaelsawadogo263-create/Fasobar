import type { Metadata } from "next";

import { DeliveryDeskWorkspace } from "@/components/delivery/delivery-desk-workspace";
import { isRetailAdminDirectSeller } from "@/lib/activity/ops-model";
import { requireDeliveryOrderDeskContext } from "@/lib/auth/workspace-context";
import { resolveDeliveryPeriod } from "@/lib/delivery/period";
import { listDeliveryOrders, listDeliveryProducts } from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";
import { getActiveCashSession } from "@/lib/payments/queries";

export const metadata: Metadata = {
  title: "Livraisons",
};

type LivraisonsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LivraisonsPage({ searchParams }: LivraisonsPageProps) {
  await requireCloudOnlineForDesktop("/application/livraisons");
  const workspace = await requireDeliveryOrderDeskContext();
  // Seule la caisse crée des commandes ici ; l'admin suit, encaisse et consulte l'historique.
  const showOrderForm = workspace.userSpace === "cashier_kitchen";
  // Chaque caisse ne voit que les livraisons qu'elle a envoyées ; l'admin voit tout.
  const createdBy = showOrderForm ? workspace.userId : undefined;
  const params = await searchParams;
  const period = resolveDeliveryPeriod(params);

  const [products, recentOrders, toCashOrders, cashSession, periodOrders] = await Promise.all([
    showOrderForm ? listDeliveryProducts(workspace) : Promise.resolve([]),
    listDeliveryOrders(workspace, { createdBy, limit: 150 }),
    // Toutes les livrées non encaissées, même anciennes : rien ne doit être oublié.
    listDeliveryOrders(workspace, {
      createdBy,
      statuses: ["DELIVERED"],
      cashed: false,
      orderBy: "delivered_at",
      limit: 500,
    }),
    getActiveCashSession(workspace),
    showOrderForm
      ? Promise.resolve(null)
      : listDeliveryOrders(workspace, {
          statuses: ["DELIVERED"],
          deliveredSince: period.start.toISOString(),
          deliveredBefore: period.end.toISOString(),
          orderBy: "delivered_at",
          limit: 1000,
        }),
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
      // L'admin boutique encaisse sans ouvrir de session (ouverte automatiquement).
      hasOpenCashSession={cashSession !== null || isRetailAdminDirectSeller(workspace)}
      showOrderForm={showOrderForm}
      history={
        periodOrders
          ? {
              period: { preset: period.preset, from: period.from, to: period.to },
              orders: periodOrders,
              initiallyOpen: typeof params.periode === "string",
            }
          : undefined
      }
    />
  );
}
