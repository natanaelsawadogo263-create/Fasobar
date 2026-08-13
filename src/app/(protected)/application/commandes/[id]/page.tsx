import { notFound } from "next/navigation";

import { OrderDetailWorkspace } from "@/components/cashier/order-detail-workspace";
import { requireOrderReadContext } from "@/lib/auth/workspace-context";
import { getOrderById } from "@/lib/orders/queries";

type CommandeDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CommandeDetailPage({ params }: CommandeDetailPageProps) {
  const workspace = await requireOrderReadContext();
  const { id } = await params;
  const order = await getOrderById(workspace, id);

  if (!order) {
    notFound();
  }

  return (
    <OrderDetailWorkspace
      order={order}
      canManageOrders={workspace.canManageOrders}
      canOperateCashRegister={workspace.canOperateCashRegister}
      activityCode={workspace.activityCode}
    />
  );
}
