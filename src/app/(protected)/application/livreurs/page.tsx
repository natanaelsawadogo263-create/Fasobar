import type { Metadata } from "next";

import { CouriersAdminWorkspace } from "@/components/delivery/couriers-admin-workspace";
import { requireDeliveryManagerContext } from "@/lib/auth/workspace-context";
import { listCourierSummaries, listDeliveryProducts } from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

export const metadata: Metadata = {
  title: "Livreurs",
};

export default async function LivreursPage() {
  await requireCloudOnlineForDesktop("/application/livreurs");
  const workspace = await requireDeliveryManagerContext();

  const [couriers, products] = await Promise.all([
    listCourierSummaries(workspace),
    listDeliveryProducts(workspace),
  ]);

  return (
    <CouriersAdminWorkspace
      establishmentId={workspace.establishmentId}
      couriers={couriers}
      stockOptions={products
        .filter((product) => product.stockQuantity > 0)
        .map((product) => ({
          productId: product.id,
          name: product.name,
          available: product.stockQuantity,
        }))}
    />
  );
}
