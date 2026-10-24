"use client";

import type { ReactNode } from "react";
import { Truck, UserRound } from "lucide-react";

import { SignOutForm } from "@/components/auth/sign-out-form";
import { FullscreenButton } from "@/components/ui/fullscreen-button";
import { LiveClock } from "@/components/ui/live-clock";

type CourierShellProps = {
  establishmentName: string;
  courierName?: string;
  children: ReactNode;
};

/**
 * Espace livreur (e-commerce) : une seule page de travail, pensée mobile —
 * pas de barre latérale, une barre supérieure fixe et le contenu plein écran.
 */
export function CourierShell({
  establishmentName,
  courierName = "Livreur",
  children,
}: CourierShellProps) {
  return (
    <div className="courier-shell app-shell flex h-dvh w-full max-w-full flex-col overflow-hidden bg-[#f4f6f8]">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white px-3 pt-[env(safe-area-inset-top)] md:gap-3 md:px-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 md:h-8 md:w-8 md:rounded-lg">
            <Truck className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-900">{establishmentName}</p>
            <p className="truncate text-[11px] text-slate-400">Espace livreur</p>
          </div>
        </div>

        <div className="hidden sm:block">
          <LiveClock showDate inline />
        </div>

        <div className="hidden md:block">
          <FullscreenButton />
        </div>

        <SignOutForm className="shrink-0">
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-1.5 shadow-sm transition active:bg-slate-50 md:h-auto md:pr-3 md:hover:border-slate-300 md:hover:bg-slate-50"
            title="Se déconnecter"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="hidden max-w-[140px] truncate text-left text-[12px] font-semibold text-slate-900 sm:block">
              {courierName}
            </span>
          </button>
        </SignOutForm>
      </header>

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
