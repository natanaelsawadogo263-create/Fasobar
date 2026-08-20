import { Suspense } from "react";

import { PageLoadingShell } from "@/components/layout/page-loading-shell";
import { ProductsWorkspace } from "@/components/products/products-workspace";
import { getProduitsPageData } from "@/lib/products/page-data";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type { ProductTab } from "@/lib/products/schemas";
import { productFiltersSchema } from "@/lib/products/schemas";

type ProduitsContentProps = {
  workspace: WorkspaceContext;
  filters: ReturnType<typeof productFiltersSchema.parse>;
};

async function ProduitsContent({ workspace, filters }: ProduitsContentProps) {
  const { products, categories, packagingsByProductId, stats } =
    await getProduitsPageData(workspace, filters);

  return (
    <ProductsWorkspace
      establishmentName={workspace.establishmentName}
      products={products}
      categories={categories}
      packagingsByProductId={packagingsByProductId}
      stats={stats}
      initialTab={filters.tab}
      initialSearch={filters.search ?? ""}
      initialCategoryId={filters.categoryId ?? ""}
      canManage={workspace.canManageProducts}
      serviceScope={workspace.serviceScope}
      activityCode={workspace.activityCode}
    />
  );
}

export function ProduitsSuspense({ workspace, filters }: ProduitsContentProps) {
  return (
    <Suspense fallback={<PageLoadingShell label="Catalogue produits…" />}>
      <ProduitsContent workspace={workspace} filters={filters} />
    </Suspense>
  );
}

export type { ProductTab };
