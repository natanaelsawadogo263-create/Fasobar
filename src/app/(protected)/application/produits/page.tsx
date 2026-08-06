import { ProductsWorkspace } from "@/components/products/products-workspace";
import { ensureProductImages } from "@/lib/products/ensure-product-images";
import { listPackagingsForProducts } from "@/lib/products/packaging-queries";
import { listCategories, listProducts } from "@/lib/products/queries";
import type { ProductStats } from "@/lib/products/types";
import { productFiltersSchema, type ProductTab } from "@/lib/products/schemas";
import { requireSpacePathAccess } from "@/lib/auth/workspace-context";

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

  await ensureProductImages(workspace);

  const filters = productFiltersSchema.parse({
    tab: (params.tab as ProductTab | undefined) ?? "all",
    search: params.search ?? "",
    categoryId: params.category ?? "",
  });

  const [products, categories, allProducts] = await Promise.all([
    listProducts(workspace, filters),
    listCategories(workspace),
    listProducts(workspace, { tab: "all", search: "", categoryId: "" }),
  ]);

  const packagingsByProductId = await listPackagingsForProducts(
    workspace,
    allProducts.filter((product) => product.departmentCode === "BAR").map((product) => product.id),
  );

  const stats: ProductStats = {
    total: allProducts.length,
    barCount: allProducts.filter((p) => p.departmentCode === "BAR" && p.active).length,
    kitchenCount: allProducts.filter((p) => p.departmentCode === "KITCHEN" && p.active).length,
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
    />
  );
}
