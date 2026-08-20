"use client";

import { InstantLink } from "@/components/layout/instant-link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Wallet } from "lucide-react";

import { openCashSessionAction } from "@/app/(protected)/application/caisse/payment-actions";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { OpenSessionModal } from "@/components/payments/open-session-modal";
import { CloseSessionModal } from "@/components/payments/close-session-modal";
import { formatPriceXof } from "@/lib/payments/constants";
import type { CashSessionDetail } from "@/lib/payments/types";

type CashSessionGateProps = {
  session: CashSessionDetail | null;
  cashierName: string;
  children: React.ReactNode;
};

export function CashSessionGate({
  session,
  cashierName,
  children,
}: CashSessionGateProps) {
  const router = useRouter();
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openError, setOpenError] = useState<string | undefined>();
  const [isOpening, startOpenTransition] = useTransition();

  function handleOpenSession(formData: FormData) {
    startOpenTransition(async () => {
      const result = await openCashSessionAction({}, formData);

      if (result.error) {
        setOpenError(result.error);
        return;
      }

      setOpenError(undefined);
      refreshSoon(() => router.refresh());
    });
  }

  return (
    <>
      {session ? (
        <div className="mb-6 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Caisse ouverte</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {cashierName} · depuis{" "}
                  {new Date(session.openedAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 sm:gap-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Fond initial</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatPriceXof(session.openingCashAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Espèces encaissées</p>
                <p className="text-sm font-semibold text-emerald-700">
                  {formatPriceXof(session.cashCollected)}
                </p>
              </div>
              <div className="flex items-end gap-2">
                <InstantLink
                  href="/application/caisse/session"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"
                >
                  Détails session
                </InstantLink>
                <button
                  type="button"
                  onClick={() => setShowCloseModal(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                >
                  <Clock className="h-4 w-4" />
                  Fermer la caisse
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {session ? children : null}

      {!session ? (
        <OpenSessionModal
          formAction={handleOpenSession}
          error={openError}
          isPending={isOpening}
        />
      ) : null}

      {session && showCloseModal ? (
        <CloseSessionModal
          session={session}
          onClose={() => setShowCloseModal(false)}
          onClosed={() => {
            setShowCloseModal(false);
            refreshSoon(() => router.refresh());
          }}
        />
      ) : null}
    </>
  );
}
