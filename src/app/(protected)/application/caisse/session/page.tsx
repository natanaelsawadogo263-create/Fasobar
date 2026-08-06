import { redirect } from "next/navigation";

import { SessionWorkspace } from "@/components/payments/session-workspace";
import { requireCashRegisterOperatorContext } from "@/lib/auth/workspace-context";
import { getActiveCashSession } from "@/lib/payments/queries";

export default async function CashSessionPage() {
  const workspace = await requireCashRegisterOperatorContext();
  const session = await getActiveCashSession(workspace);

  if (!session) {
    redirect("/application/caisse");
  }

  return (
    <SessionWorkspace
      session={session}
      establishmentName={workspace.establishmentName}
    />
  );
}
