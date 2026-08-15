import { InventoryWorkspace } from "@/components/stock/inventory-workspace";
import { requireStockReadContext } from "@/lib/auth/workspace-context";
import { isDepartmentAllowed } from "@/lib/settings/service-scope";
import { listInventorySessions } from "@/lib/stock/queries";

export default async function InventairesPage() {
  const workspace = await requireStockReadContext();
  const sessions = (await listInventorySessions(workspace)).filter((session) =>
    isDepartmentAllowed(
      workspace.serviceScope,
      session.departmentCode === "KITCHEN" ? "KITCHEN" : "BAR",
    ),
  );

  return (
    <InventoryWorkspace
      establishmentName={workspace.establishmentName}
      sessions={sessions}
      canManageStock={workspace.canManageStock}
      serviceScope={workspace.serviceScope}
    />
  );
}
