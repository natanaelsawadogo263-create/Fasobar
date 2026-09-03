"use client";

import { InstantLink as Link } from "@/components/layout/instant-link";
import { Circle, Home, UserRound } from "lucide-react";

import { AdminNotificationsBell } from "@/components/admin/admin-notifications-bell";
import { EnablePushButton } from "@/components/notifications/enable-push-button";
import { signOutAction } from "@/lib/auth/actions";
import { FullscreenButton } from "@/components/ui/fullscreen-button";
import { LiveClock } from "@/components/ui/live-clock";

type BarTopbarProps = {
  establishmentName: string;
  establishmentId?: string;
  managerName?: string;
  hasOwnSession?: boolean;
  sessionOpenedAt?: string;
  openSessionHolderName?: string | null;
};

export function BarTopbar({
  establishmentName,
  establishmentId,
  managerName = "Responsable Bar",
  hasOwnSession = false,
  sessionOpenedAt,
  openSessionHolderName,
}: BarTopbarProps) {
  const openedLabel = sessionOpenedAt
    ? new Date(sessionOpenedAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const sessionTone = hasOwnSession
    ? "text-emerald-500"
    : openSessionHolderName
      ? "text-amber-500"
      : "text-slate-400";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white px-3 pt-[env(safe-area-inset-top)] md:gap-3 md:px-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 md:h-8 md:w-8 md:rounded-lg">
          <Home className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-900">
            {establishmentName}
          </p>
          <p className="truncate text-[11px] text-slate-400 md:hidden">
            {hasOwnSession
              ? "Service ouvert"
              : openSessionHolderName
                ? "Relève en attente"
                : "Service fermé"}
          </p>
          <p className="hidden text-[11px] text-slate-400 md:block">Établissement</p>
        </div>
      </div>

      <Link
        href="/application/bar/session"
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 transition active:bg-emerald-50/60 md:h-auto md:gap-2 md:px-3 md:py-1.5 md:hover:border-emerald-200 md:hover:bg-emerald-50/50"
        title="Ma session"
      >
        <Circle className={`h-2 w-2 shrink-0 fill-current ${sessionTone}`} />
        <span className="sr-only md:not-sr-only md:inline whitespace-nowrap text-[12px] text-slate-700">
          {hasOwnSession ? (
            <>
              <span className="font-semibold text-emerald-800">Ouvert</span>
              {openedLabel ? (
                <span className="text-slate-400"> · {openedLabel}</span>
              ) : null}
            </>
          ) : openSessionHolderName ? (
            <span className="font-semibold text-amber-800">Relève</span>
          ) : (
            <span className="font-semibold text-slate-600">Fermé</span>
          )}
        </span>
      </Link>

      <EnablePushButton />

      {establishmentId ? (
        <AdminNotificationsBell establishmentId={establishmentId} />
      ) : null}

      <div className="hidden lg:block">
        <LiveClock />
      </div>

      <div className="hidden md:block">
        <FullscreenButton />
      </div>

      <form action={signOutAction} className="shrink-0">
        <button
          type="submit"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-1.5 shadow-sm transition active:bg-slate-50 md:h-auto md:pr-3 md:hover:border-slate-300 md:hover:bg-slate-50"
          title="Se déconnecter"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <UserRound className="h-4 w-4" />
          </span>
          <span className="hidden max-w-[120px] truncate text-left text-[12px] font-semibold text-slate-900 sm:block">
            {managerName}
          </span>
        </button>
      </form>
    </header>
  );
}
