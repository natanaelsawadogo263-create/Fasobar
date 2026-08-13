import { notFound } from "next/navigation";

import { ThermalReceipt } from "@/components/payments/thermal-receipt";
import { requireOrderReadContext } from "@/lib/auth/workspace-context";
import { getReceiptById } from "@/lib/payments/queries";

type ReceiptPageProps = {
  params: Promise<{
    receiptId: string;
  }>;
  searchParams: Promise<{
    print?: string;
    next?: string;
  }>;
};

const CAISSE_NEXT = "/application/caisse?fresh=1";
const ADMIN_VENTES_NEXT = "/application/ventes";

function resolveReturnTo(
  next: string | undefined,
  userSpace: string,
): string | null {
  if (!next) {
    return userSpace === "admin" ? ADMIN_VENTES_NEXT : null;
  }

  if (next === "/application/caisse" || next.startsWith("/application/caisse?")) {
    return next.includes("fresh=") ? next : "/application/caisse?fresh=1";
  }

  if (next === "/application/ventes" || next.startsWith("/application/ventes?")) {
    return next;
  }

  if (next.startsWith("/application/caisses")) {
    return next;
  }

  return userSpace === "admin" ? ADMIN_VENTES_NEXT : null;
}

export default async function ReceiptPage({ params, searchParams }: ReceiptPageProps) {
  const workspace = await requireOrderReadContext();
  const { receiptId } = await params;
  const query = await searchParams;

  const receipt = await getReceiptById(workspace, receiptId);

  if (!receipt) {
    notFound();
  }

  const autoPrint = query.print === "1";
  const returnTo =
    resolveReturnTo(query.next, workspace.userSpace) ??
    (workspace.userSpace === "admin" ? ADMIN_VENTES_NEXT : CAISSE_NEXT);

  return (
    <ThermalReceipt
      receipt={receipt}
      autoPrint={autoPrint}
      returnTo={returnTo}
    />
  );
}
