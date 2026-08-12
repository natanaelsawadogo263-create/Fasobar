"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

type CashierSecondaryShellProps = {
  children: ReactNode;
};

/** Pages secondaires Caisse–Cuisine (dépenses, appro) — sans sidebar, juste un retour. */
export function CashierSecondaryShell({ children }: CashierSecondaryShellProps) {
  return (
    <div className="app-shell flex h-dvh w-full max-w-full flex-col overflow-hidden bg-slate-50">
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-2.5">
        <Link
          href="/application/caisse"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour à la caisse
        </Link>
      </div>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
