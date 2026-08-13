import { redirect } from "next/navigation";

import { BarHistoryWorkspace } from "@/components/bar/bar-history-workspace";
import { BarSessionGate } from "@/components/bar/bar-session-gate";
import { requireBarManagerContext } from "@/lib/auth/workspace-context";
import { listBarHistoryMovements } from "@/lib/bar/queries";
import { getBarSessionContext } from "@/lib/bar/session-queries";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";
import { listStockItems } from "@/lib/stock/queries";

type PageProps = {
  searchParams: Promise<{ produit?: string }>;
};

export default async function BarHistoryPage({ searchParams }: PageProps) {
  const workspace = await requireBarManagerContext();

  if (
    !isPathAllowedForSpace(
      "/application/bar/historique",
      workspace.userSpace,
      workspace.serviceScope,
      workspace.activityCode,
    )
  ) {
    redirect("/application/acces-refuse");
  }

  const params = await searchParams;

  const [{ openSession }, items, rows] = await Promise.all([
    getBarSessionContext(workspace),
    listStockItems(workspace, { tab: "bar", status: "all" }),
    listBarHistoryMovements(workspace, {
      stockItemId: params.produit || undefined,
      limit: 300,
    }),
  ]);

  return (
    <BarSessionGate
      openSession={openSession}
      managerName={workspace.ownerName}
      requireSession={false}
      showBanner={false}
    >
      <BarHistoryWorkspace
        rows={rows}
        products={items.map((item) => ({ id: item.id, name: item.name }))}
        initialProductId={params.produit ?? ""}
      />
    </BarSessionGate>
  );
}
