import { redirect } from "next/navigation";

import { CaissePageSuspense } from "@/app/(protected)/application/caisse/caisse-page-content";
import { requireCashRegisterOperatorContext } from "@/lib/auth/workspace-context";

type CaissePageProps = {
  searchParams: Promise<{
    order?: string;
    fresh?: string;
    t?: string;
  }>;
};

export default async function CaissePage({ searchParams }: CaissePageProps) {
  const [workspace, params] = await Promise.all([
    requireCashRegisterOperatorContext(),
    searchParams,
  ]);

  return <CaissePageSuspense workspace={workspace} params={params} />;
}
