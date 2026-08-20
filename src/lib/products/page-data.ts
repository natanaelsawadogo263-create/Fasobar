import "server-only";

import { cache } from "react";

import { usesTradeCatalog } from "@/lib/activity/ops-model";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { ensureProductImages } from "@/lib/products/ensure-product-images";
import { listPackagingsForProducts } from "@/lib/products/packaging-queries";
import { ensureRetailCategories } from "@/lib/products/ensure-retail-categories";
import { listProducts } from "@/lib/products/queries";
import type { ProductFiltersInput } from "@/lib/products/schemas";
import type { ProductStats } from "@/lib/products/types";

export const getProduitsPageData = cache(async function getProduitsPageData(
  workspace: WorkspaceContext,
  filters: ProductFiltersInput,
) {
  const tradeCatalog = usesTradeCatalog(workspace.activityCode);

  const packagingsSeedPromise = tradeCatalog
    ? Promise.resolve({} as Record<string, unknown>)
    : listProducts(workspace, { tab: "bar", search: "", categoryId: "" }).then((barProducts) => {
        const ids = barProducts.map((product) => product.id);
        if (ids.length === 0) return {};
        return listPackagingsForProducts(workspace, ids);
      });

  const [, products, categories, packagingsByProductId] = await Promise.all([
    ensureProductImages(workspace),
    listProducts(workspace, filters),
    ensureRetailCategories(workspace),
    packagingsSeedPromise,
  ]);

  const stats: ProductStats = {
    total: products.length,
    barCount: products.filter((p) => p.departmentCode === "BAR" && p.active).length,
    kitchenCount: products.filter((p) => p.departmentCode === "KITCHEN" && p.active).length,
    inactiveCount: products.filter((p) => !p.active).length,
  };

  return {
    products,
    categories,
    packagingsByProductId: packagingsByProductId as Record<
      string,
      import("@/lib/products/types").ProductPackaging[]
    >,
    stats,
  };
});
