import { notFound } from "next/navigation";

import { ProductLabel } from "@/components/products/product-label";
import { requireProductManagementContext } from "@/lib/auth/workspace-context";
import { getProductById } from "@/lib/products/queries";

type LabelPageProps = {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ print?: string }>;
};

export default async function ProductLabelPage({ params, searchParams }: LabelPageProps) {
  const [workspace, { productId }, query] = await Promise.all([
    requireProductManagementContext(),
    params,
    searchParams,
  ]);

  const product = await getProductById(workspace, productId);

  if (!product) {
    notFound();
  }

  return (
    <ProductLabel
      productName={product.name}
      sellingPrice={product.sellingPrice}
      barcode={product.barcode ?? null}
      establishmentName={workspace.establishmentName}
      returnTo="/application/produits"
      autoPrint={query.print === "1"}
    />
  );
}
