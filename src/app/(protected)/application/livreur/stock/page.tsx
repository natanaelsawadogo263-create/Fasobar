import type { Metadata } from "next";

import { CourierStock } from "@/components/delivery/courier-stock";
import { requireDeliveryCourierContext } from "@/lib/auth/workspace-context";
import { getCourierStock, listCourierMovements } from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

export const metadata: Metadata = {
  title: "Mon stock",
};

export default async function LivreurStockPage() {
  await requireCloudOnlineForDesktop("/application/livreur/stock");
  const workspace = await requireDeliveryCourierContext();

  const [stock, movements] = await Promise.all([
    getCourierStock(workspace, workspace.userId),
    listCourierMovements(workspace, workspace.userId, 30),
  ]);

  return <CourierStock stock={stock} movements={movements} />;
}
