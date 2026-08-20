import { redirect } from "next/navigation";

import { StockPageSuspense } from "@/app/(protected)/application/stock/stock-page-content";
import { requireStockReadContext } from "@/lib/auth/workspace-context";
import { hasBarService, hasKitchenService } from "@/lib/settings/service-scope";

type StockPageProps = {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    category?: string;
    status?: string;
  }>;
};

export default async function StockPage({ searchParams }: StockPageProps) {
  const [params, workspace] = await Promise.all([
    searchParams,
    requireStockReadContext(),
  ]);

  if (!hasBarService(workspace.serviceScope) && hasKitchenService(workspace.serviceScope)) {
    redirect("/application/stock/cuisine");
  }

  return <StockPageSuspense workspace={workspace} params={params} />;
}
