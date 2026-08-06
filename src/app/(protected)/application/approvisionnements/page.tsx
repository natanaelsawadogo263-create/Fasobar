import { SupplyWorkspace } from "@/components/stock/supply-workspace";
import { ensureBarStockItemsFromProducts } from "@/lib/bar/ensure-stock";
import { requireStockReadContext } from "@/lib/auth/workspace-context";
import { listPackagingsForProducts } from "@/lib/products/packaging-queries";
import {
  listRecentSupplyEntries,
  listSuppliers,
} from "@/lib/stock/queries";

export default async function ApprovisionnementsPage() {
  const workspace = await requireStockReadContext();

  const [suppliers, stockItems, recentEntries] = await Promise.all([
    listSuppliers(workspace),
    ensureBarStockItemsFromProducts(workspace),
    listRecentSupplyEntries(workspace, { departmentCode: "BAR" }),
  ]);

  const productIds = stockItems
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));
  const packagingsByProduct = await listPackagingsForProducts(workspace, productIds);

  return (
    <SupplyWorkspace
      establishmentName={workspace.establishmentName}
      suppliers={suppliers}
      stockItems={stockItems}
      recentEntries={recentEntries}
      packagingsByProduct={packagingsByProduct}
      canManageStock={workspace.canManageBarStock}
    />
  );
}
