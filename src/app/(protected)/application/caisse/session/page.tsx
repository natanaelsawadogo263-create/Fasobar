import Link from "next/link";

import { SessionWorkspace } from "@/components/payments/session-workspace";
import { requireCashRegisterOperatorContext } from "@/lib/auth/workspace-context";
import { getActiveCashSession } from "@/lib/payments/queries";

export default async function CashSessionPage() {
  const workspace = await requireCashRegisterOperatorContext();
  const session = await getActiveCashSession(workspace);

  if (!session) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-[18px] font-bold text-slate-900">Caisse encore fermée</h1>
        <p className="mt-2 max-w-sm text-[14px] text-slate-600">
          Ouvrez d’abord la caisse pour voir le résumé de votre session.
        </p>
        <Link
          href="/application/caisse"
          className="mt-5 inline-flex h-11 min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-[13px] font-semibold text-white"
        >
          Aller à la vente
        </Link>
      </div>
    );
  }

  return (
    <SessionWorkspace
      session={session}
      establishmentName={workspace.establishmentName}
      activityCode={workspace.activityCode}
    />
  );
}
