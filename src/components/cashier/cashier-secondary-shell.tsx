"use client";

import { InstantLink } from "@/components/layout/instant-link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

type CashierSecondaryShellProps = {
  children: ReactNode;
};

/** Pages secondaires Caisse–Cuisine (dépenses, appro) — sans sidebar, juste un retour. */
export function CashierSecondaryShell({ children }: CashierSecondaryShellProps) {
  return (
    <div className="app-shell flex h-dvh w-full max-w-full flex-col overflow-hidden bg-slate-50">
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-3 pb-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-4">
        <InstantLink
          href="/application/caisse"
          className="inline-flex h-11 min-w-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-sm active:bg-emerald-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la caisse
        </InstantLink>
      </div>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
        {children}
      </main>
    </div>
  );
}
