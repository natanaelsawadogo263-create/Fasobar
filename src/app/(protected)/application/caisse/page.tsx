import { CashierWorkspace } from "@/components/cashier/cashier-workspace";
import { requireCashRegisterOperatorContext } from "@/lib/auth/workspace-context";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import { ensureRetailCategories } from "@/lib/products/ensure-retail-categories";
import {
  getOrderById,
  listCashierCategories,
  listCashierOrders,
  listCashierProducts,
} from "@/lib/orders/queries";
import { getActiveCashSession } from "@/lib/payments/queries";

type CaissePageProps = {
  searchParams: Promise<{
    order?: string;
    fresh?: string;
    t?: string;
  }>;
};

export default async function CaissePage({ searchParams }: CaissePageProps) {
  const workspace = await requireCashRegisterOperatorContext();
  const params = await searchParams;
  const freshCart = params.fresh === "1";

  if (isDesktopServerRuntime()) {
    const { ensureCaisseCatalog } = await import("@/lib/caisse/ensure-catalog");
    await ensureCaisseCatalog(workspace);
  }
  await ensureRetailCategories(workspace);

  const [categories, products, initialOrder, session] = await Promise.all([
    listCashierCategories(workspace),
    listCashierProducts(workspace),
    params.order && !freshCart ? getOrderById(workspace, params.order) : Promise.resolve(null),
    getActiveCashSession(workspace),
  ]);

  const openOrders = await listCashierOrders(workspace, {
    includeFinalized: true,
    sessionOpenedAt: session?.openedAt ?? null,
  });

  return (
    <CashierWorkspace
      key={freshCart ? `fresh-${params.t ?? "1"}` : (params.order ?? "new")}
      cashierName={workspace.ownerName}
      categories={categories}
      products={products}
      openOrders={openOrders}
      session={session}
      initialOrder={initialOrder}
      freshCart={freshCart}
      serviceScope={workspace.serviceScope}
      activityCode={workspace.activityCode}
    />
  );
}
