import { redirect } from "next/navigation";

import { BarOrdersWorkspace } from "@/components/bar/bar-orders-workspace";
import { BarSessionGate } from "@/components/bar/bar-session-gate";
import { requireBarManagerContext } from "@/lib/auth/workspace-context";
import { listBarDrinkOrders } from "@/lib/bar/queries";
import { getBarSessionContext } from "@/lib/bar/session-queries";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";

export default async function BarOrdersPage() {
  const workspace = await requireBarManagerContext();

  if (!isPathAllowedForSpace("/application/bar/commandes", workspace.userSpace)) {
    redirect("/application/acces-refuse");
  }

  const [{ openSession }, orders] = await Promise.all([
    getBarSessionContext(workspace),
    listBarDrinkOrders(workspace),
  ]);

  return (
    <BarSessionGate
      openSession={openSession}
      managerName={workspace.ownerName}
      requireSession
      showBanner={false}
    >
      <BarOrdersWorkspace orders={orders} />
    </BarSessionGate>
  );
}
