import { notFound } from "next/navigation";

import { ThermalAddition } from "@/components/payments/thermal-addition";
import { requireOrderReadContext } from "@/lib/auth/workspace-context";
import { getOrderAddition } from "@/lib/payments/queries";

type AdditionPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function CaisseAdditionPage({
  params,
  searchParams,
}: AdditionPageProps) {
  const workspace = await requireOrderReadContext();
  const { id } = await params;
  const query = await searchParams;

  const addition = await getOrderAddition(workspace, id);
  if (!addition) {
    notFound();
  }

  const returnTo =
    query.from === "cuisine" ? "/application/cuisine" : "/application/caisse";

  return (
    <ThermalAddition
      addition={addition}
      returnTo={returnTo}
      activityCode={workspace.activityCode}
    />
  );
}
