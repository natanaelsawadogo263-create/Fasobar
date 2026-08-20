import "server-only";

import { cache } from "react";

import { isRetailActivity } from "@/lib/activity/profile";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import {
  getOrderById,
  listCashierCategories,
  listCashierOrders,
  listCashierProducts,
} from "@/lib/orders/queries";
import { ensureRetailCategories } from "@/lib/products/ensure-retail-categories";
import { getActiveCashSession } from "@/lib/payments/queries";

export type CaissePageData = Awaited<ReturnType<typeof getCaissePageData>>;

export const getCaissePageData = cache(async function getCaissePageData(
  workspace: WorkspaceContext,
  params: { order?: string; fresh?: string; t?: string },
) {
  const freshCart = params.fresh === "1";

  const catalogHydrate = isDesktopServerRuntime()
    ? import("@/lib/caisse/ensure-catalog").then(({ ensureCaisseCatalog }) =>
        ensureCaisseCatalog(workspace),
      )
    : Promise.resolve();

  if (isRetailActivity(workspace.activityCode)) {
    void ensureRetailCategories(workspace);
  }

  const categoriesPromise = listCashierCategories(workspace);

  const [categories, products, initialOrder, session, openOrders] = await Promise.all([
    categoriesPromise,
    listCashierProducts(workspace),
    params.order && !freshCart ? getOrderById(workspace, params.order) : Promise.resolve(null),
    getActiveCashSession(workspace),
    listCashierOrders(workspace, {
      includeFinalized: false,
      sessionOpenedAt: null,
    }),
    catalogHydrate,
  ]);

  return {
    freshCart,
    categories,
    products,
    initialOrder,
    session,
    openOrders,
  };
});
