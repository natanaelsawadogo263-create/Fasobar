import { notFound } from "next/navigation";

import { ThermalAddition } from "@/components/payments/thermal-addition";
import { requireOrderReadContext } from "@/lib/auth/workspace-context";
import { getOrderAddition } from "@/lib/payments/queries";

type AdditionPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string; next?: string }>;
};

function resolveReturnTo(next: string | undefined): string | null {
  if (!next) return null;
  if (next.startsWith("/application/caisse")) return next;
  if (next.startsWith("/application/cuisine")) return next;
  if (next.startsWith("/application/commandes")) return next;
  return null;
}

export default async function OrderAdditionPage({
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

  const autoPrint = query.print === "1";
  const returnTo =
    resolveReturnTo(query.next) ??
    (autoPrint ? `/application/caisse?order=${id}` : null);

  return (
    <ThermalAddition
      addition={addition}
      autoPrint={autoPrint}
      returnTo={returnTo}
    />
  );
}
