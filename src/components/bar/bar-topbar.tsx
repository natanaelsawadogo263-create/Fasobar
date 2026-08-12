"use client";

import Link from "next/link";
import { ChevronDown, Circle, Home, UserRound } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";
import { FullscreenButton } from "@/components/ui/fullscreen-button";
import { LiveClock } from "@/components/ui/live-clock";

type BarTopbarProps = {
  establishmentName: string;
  managerName?: string;
  hasOwnSession?: boolean;
  sessionOpenedAt?: string;
  openSessionHolderName?: string | null;
};

export function BarTopbar({
  establishmentName,
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

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-3 pt-[env(safe-area-inset-top)] md:gap-4 md:px-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 md:h-8 md:w-8 md:rounded-lg">
          <Home className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-900">
            {establishmentName}
          </p>
          <p className="text-[11px] text-slate-400">Établissement</p>
        </div>
      </div>

      <Link
        href="/application/bar/session"
        className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 transition hover:border-emerald-200 hover:bg-emerald-50/50 md:flex"
        title="Ma session"
      >
        <Circle
          className={`h-2 w-2 fill-current ${
            hasOwnSession
              ? "text-emerald-500"
              : openSessionHolderName
                ? "text-amber-500"
                : "text-slate-400"
          }`}
        />
        <p className="whitespace-nowrap text-[12px] text-slate-700">
          {hasOwnSession ? (
            <>
              <span className="font-semibold text-emerald-800">Service ouvert</span>
              {openedLabel ? (
                <span className="text-slate-400"> · depuis {openedLabel}</span>
              ) : null}
            </>
          ) : openSessionHolderName ? (
            <>
              <span className="font-semibold text-amber-800">Relève en attente</span>
              <span className="text-slate-400"> · {openSessionHolderName}</span>
            </>
          ) : (
            <span className="font-semibold text-slate-600">Service fermé</span>
          )}
        </p>
      </Link>

      <LiveClock className="hidden lg:inline-flex" />

      <FullscreenButton className="hidden h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-100 md:inline-flex" />

      <div className="flex flex-1 items-center justify-end">
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            title="Se déconnecter"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[120px] truncate text-[12px] font-semibold text-slate-900">
                {managerName}
              </span>
              <span className="block text-[10px] text-slate-400">Déconnexion</span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
          </button>
        </form>
      </div>
    </header>
  );
}
