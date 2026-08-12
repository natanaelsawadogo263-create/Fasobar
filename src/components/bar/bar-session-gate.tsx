"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Clock3, Lock, UserRound } from "lucide-react";

import { openBarSessionAction } from "@/app/(protected)/application/bar/actions";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { OpenBarSessionModal } from "@/components/bar/open-bar-session-modal";
import type { BarSessionDetail } from "@/lib/bar/session-types";

type BarSessionGateProps = {
  openSession: BarSessionDetail | null;
  managerName: string;
  /** Si false, affiche le contenu même sans session (ex. dashboard, historique). */
  requireSession?: boolean;
  /** Si false, masque le bandeau (ex. dashboard qui intègre déjà le statut). */
  showBanner?: boolean;
  children: React.ReactNode;
};

export function BarSessionGate({
  openSession,
  managerName,
  requireSession = true,
  showBanner = true,
  children,
}: BarSessionGateProps) {
  const router = useRouter();
  const [openError, setOpenError] = useState<string | undefined>();
  const [isOpening, startOpenTransition] = useTransition();

  const ownSession = openSession?.isOwnSession ? openSession : null;
  const heldByOther = Boolean(openSession && !openSession.isOwnSession);
  const showChildren = Boolean(ownSession) || !requireSession;

  function handleOpenSession(formData: FormData) {
    startOpenTransition(async () => {
      const result = await openBarSessionAction({}, formData);
      if (result.error) {
        setOpenError(result.error);
        return;
      }
      setOpenError(undefined);
      refreshSoon(() => router.refresh());
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {showBanner && ownSession ? (
        <div className="shrink-0 px-4 pt-4 lg:px-6 lg:pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Clock3 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-emerald-900">
                  Service ouvert
                </p>
                <p className="truncate text-[12px] text-emerald-800/70">
                  {ownSession.openedByName ?? managerName} · depuis{" "}
                  {new Date(ownSession.openedAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            <Link
              href="/application/bar/session"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-300 bg-white px-3.5 text-[12px] font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              Bilan / Clôturer
            </Link>
          </div>
        </div>
      ) : null}

      {showBanner && heldByOther && openSession ? (
        <div className="shrink-0 px-4 pt-4 lg:px-6 lg:pt-5">
          <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Lock className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-amber-950">
                  Service en cours — relève en attente
                </p>
                <p className="mt-0.5 text-[12px] text-amber-900/80">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <UserRound className="h-3.5 w-3.5" />
                    {openSession.openedByName ?? "Un autre responsable"}
                  </span>{" "}
                  doit clôturer avant que vous preniez la relève.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showChildren ? (
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      ) : null}

      {!openSession ? (
        <OpenBarSessionModal
          formAction={handleOpenSession}
          error={openError}
          isPending={isOpening}
          managerName={managerName}
        />
      ) : null}
    </div>
  );
}
