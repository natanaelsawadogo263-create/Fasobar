import { ProduitsSuspense } from "@/app/(protected)/application/produits/produits-content";
import { requireSpacePathAccess } from "@/lib/auth/workspace-context";
import { productFiltersSchema, type ProductTab } from "@/lib/products/schemas";

type ProduitsPageProps = {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    category?: string;
  }>;
};

export default async function ProduitsPage({ searchParams }: ProduitsPageProps) {
  const [workspace, params] = await Promise.all([
    requireSpacePathAccess("/application/produits"),
    searchParams,
  ]);

  const filters = productFiltersSchema.parse({
    tab: (params.tab as ProductTab | undefined) ?? "all",
    search: params.search ?? "",
    categoryId: params.category ?? "",
  });

  return <ProduitsSuspense workspace={workspace} filters={filters} />;
}
