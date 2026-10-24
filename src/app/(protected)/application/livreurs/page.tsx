import type { Metadata } from "next";

import { CouriersAdminWorkspace } from "@/components/delivery/couriers-admin-workspace";
import { requireDeliveryManagerContext } from "@/lib/auth/workspace-context";
import { resolveDeliveryPeriod } from "@/lib/delivery/period";
import { getCourierPeriodReport, listDeliveryProducts } from "@/lib/delivery/queries";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

export const metadata: Metadata = {
  title: "Livreurs",
};

type LivreursPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LivreursPage({ searchParams }: LivreursPageProps) {
  await requireCloudOnlineForDesktop("/application/livreurs");
  const workspace = await requireDeliveryManagerContext();
  const period = resolveDeliveryPeriod(await searchParams);

  const [report, products] = await Promise.all([
    getCourierPeriodReport(workspace, period),
    listDeliveryProducts(workspace),
  ]);

  return (
    <CouriersAdminWorkspace
      establishmentId={workspace.establishmentId}
      couriers={report.couriers}
      daily={report.daily}
      period={{ preset: period.preset, from: period.from, to: period.to }}
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
