import { Lock, UserRound } from "lucide-react";
import { redirect } from "next/navigation";

import { BarSessionGate } from "@/components/bar/bar-session-gate";
import { BarSessionWorkspace } from "@/components/bar/bar-session-workspace";
import { requireBarManagerContext } from "@/lib/auth/workspace-context";
import { getBarSessionContext } from "@/lib/bar/session-queries";
import { isPathAllowedForSpace } from "@/lib/navigation/space-navigation";

export default async function BarSessionPage() {
  const workspace = await requireBarManagerContext();

  if (
    !isPathAllowedForSpace(
      "/application/bar/session",
      workspace.userSpace,
      workspace.serviceScope,
      workspace.activityCode,
    )
  ) {
    redirect("/application/acces-refuse");
  }

  const { ownSession, openSession } = await getBarSessionContext(workspace);

  if (ownSession) {
    return (
      <BarSessionWorkspace
        session={ownSession}
        establishmentName={workspace.establishmentName}
      />
    );
  }

  const heldByOther = openSession && !openSession.isOwnSession;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-4 lg:px-6 lg:py-5">
      <header className="mb-4 shrink-0">
        <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
          Ma session
        </h1>
        <p className="mt-0.5 text-[12px] text-slate-500">
          {heldByOther
            ? "Un service est déjà en cours — la relève sera possible après clôture."
            : "Ouvrez votre service pour démarrer votre bilan."}
        </p>
      </header>

      {heldByOther && openSession ? (
        <div className="mb-4 shrink-0 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Lock className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-amber-950">
                Relève en attente
              </p>
              <p className="mt-0.5 text-[12px] text-amber-900/80">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <UserRound className="h-3.5 w-3.5" />
                  {openSession.openedByName ?? "Un autre responsable"}
                </span>{" "}
                · depuis{" "}
                {new Date(openSession.openedAt).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <BarSessionGate
        openSession={openSession}
        managerName={workspace.ownerName}
        requireSession={false}
        showBanner={false}
      >
        {!heldByOther ? (
          <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
            <div>
              <p className="text-[13px] font-medium text-slate-800">
                Aucun service ouvert
              </p>
              <p className="mt-1 text-[12px] text-slate-500">
                Utilisez le formulaire d&apos;ouverture pour démarrer.
              </p>
            </div>
          </div>
        ) : (
          <div />
        )}
      </BarSessionGate>
    </div>
  );
}
