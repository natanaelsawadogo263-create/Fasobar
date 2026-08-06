import { KitchenWorkspace } from "@/components/kitchen/kitchen-workspace";
import { requireKitchenContext } from "@/lib/auth/workspace-context";
import { listKitchenOrders } from "@/lib/kitchen/queries";

export default async function CuisinePage() {
  const workspace = await requireKitchenContext();
  const orders = await listKitchenOrders(workspace);

  return <KitchenWorkspace orders={orders} />;
}
