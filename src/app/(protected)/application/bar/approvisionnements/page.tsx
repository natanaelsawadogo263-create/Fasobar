import { redirect } from "next/navigation";

import { BarSessionGate } from "@/components/bar/bar-session-gate";
import { SupplyWorkspace } from "@/components/stock/supply-workspace";
import { ensureBarStockItemsFromProducts } from "@/lib/bar/ensure-stock";
import { requireBarManagerContext } from "@/lib/auth/workspace-context";
import { getBarSessionContext } from "@/lib/bar/session-queries";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";
import { listPackagingsForProducts } from "@/lib/products/packaging-queries";
import {
  listRecentSupplyEntries,
  listSuppliers,
} from "@/lib/stock/queries";

export default async function BarApprovisionnementsPage() {
  const workspace = await requireBarManagerContext();

  if (
    !isPathAllowedForSpace(
      "/application/bar/approvisionnements",
      workspace.userSpace,
    )
  ) {
    redirect("/application/acces-refuse");
  }

  const [{ openSession }, suppliers, stockItems, recentEntries] =
    await Promise.all([
      getBarSessionContext(workspace),
      listSuppliers(workspace),
      ensureBarStockItemsFromProducts(workspace),
      listRecentSupplyEntries(workspace, { departmentCode: "BAR" }),
    ]);

  const productIds = stockItems
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));
  const packagingsByProduct = await listPackagingsForProducts(
    workspace,
    productIds,
  );

  return (
    <BarSessionGate
      openSession={openSession}
      managerName={workspace.ownerName}
      requireSession
      showBanner={false}
    >
      <SupplyWorkspace
        establishmentName={workspace.establishmentName}
        suppliers={suppliers}
        stockItems={stockItems}
        recentEntries={recentEntries}
        packagingsByProduct={packagingsByProduct}
        canManageStock={workspace.canManageBarStock}
        compact
      />
    </BarSessionGate>
  );
}
