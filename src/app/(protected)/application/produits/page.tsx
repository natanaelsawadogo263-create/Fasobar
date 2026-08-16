import { ProductsWorkspace } from "@/components/products/products-workspace";
import { ensureProductImages } from "@/lib/products/ensure-product-images";
import { listPackagingsForProducts } from "@/lib/products/packaging-queries";
import { ensureRetailCategories } from "@/lib/products/ensure-retail-categories";
import { listProducts } from "@/lib/products/queries";
import type { ProductStats } from "@/lib/products/types";
import { productFiltersSchema, type ProductTab } from "@/lib/products/schemas";
import { requireSpacePathAccess } from "@/lib/auth/workspace-context";
import { usesTradeCatalog } from "@/lib/activity/ops-model";

type ProduitsPageProps = {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    category?: string;
  }>;
};

export default async function ProduitsPage({ searchParams }: ProduitsPageProps) {
  const workspace = await requireSpacePathAccess("/application/produits");
  const params = await searchParams;

  const filters = productFiltersSchema.parse({
    tab: (params.tab as ProductTab | undefined) ?? "all",
    search: params.search ?? "",
    categoryId: params.category ?? "",
  });

  // Images en parallèle du catalogue (TTL interne) — ne bloque plus la liste.
  const [, allProducts, categories] = await Promise.all([
    ensureProductImages(workspace),
    listProducts(workspace, { tab: "all", search: "", categoryId: "" }),
    ensureRetailCategories(workspace),
  ]);

  const search = (filters.search ?? "").trim().toLowerCase();
  const products = allProducts.filter((product) => {
    if (filters.tab === "bar" && product.departmentCode !== "BAR") return false;
    if (filters.tab === "kitchen" && product.departmentCode !== "KITCHEN") return false;
    if (filters.tab === "unavailable" && product.active) return false;
    if (filters.categoryId && product.categoryId !== filters.categoryId) return false;
    if (search && !product.name.toLowerCase().includes(search)) return false;
    return true;
  });

  const packagingsByProductId = usesTradeCatalog(workspace.activityCode)
    ? {}
    : await listPackagingsForProducts(
        workspace,
        allProducts
          .filter((product) => product.departmentCode === "BAR")
          .map((product) => product.id),
      );

  const stats: ProductStats = {
    total: allProducts.length,
    barCount: allProducts.filter((p) => p.departmentCode === "BAR" && p.active).length,
    kitchenCount: allProducts.filter((p) => p.departmentCode === "KITCHEN" && p.active)
      .length,
    inactiveCount: allProducts.filter((p) => !p.active).length,
  };

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
