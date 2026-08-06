import { InventoryWorkspace } from "@/components/stock/inventory-workspace";
import { requireStockReadContext } from "@/lib/auth/workspace-context";
import { listInventorySessions } from "@/lib/stock/queries";

export default async function InventairesPage() {
  const workspace = await requireStockReadContext();
  const sessions = await listInventorySessions(workspace);

  return (
    <InventoryWorkspace
      establishmentName={workspace.establishmentName}
      sessions={sessions}
      canManageStock={workspace.canManageStock}
    />
  );
}
