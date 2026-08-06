"use client";

import Link from "next/link";
import { ChevronDown, Lock, Package, User, Wifi } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { useFasoBarCashier } from "@/components/fasobar/fasobar-cashier-context";

export function FasoBarTopbar() {
  const ctx = useFasoBarCashier();

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] bg-[#0b1220] px-4 text-white">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/application/caisse" className="shrink-0 text-[17px] font-bold tracking-tight text-white">
          FasoBar
        </Link>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-200"
        >
          {ctx?.establishmentName ?? "Maquis"}
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </button>
      </div>

      <div className="hidden items-center gap-5 md:flex">
        <StatusPill
          dotClass="bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]"
          label={ctx?.hasSession ? "Caisse ouverte" : "Caisse fermée"}
        />
        <StatusPill icon={<User className="h-3.5 w-3.5 text-slate-400" />} label={ctx?.cashierName ?? "—"} />
        <StatusPill icon={<Wifi className="h-3.5 w-3.5 text-emerald-400" />} label="En ligne" />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {ctx?.onOpenOrders ? (
          <button
            type="button"
            onClick={ctx.onOpenOrders}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-white/10"
          >
            <Package className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Commandes du jour</span>
            {(ctx.openOrdersCount ?? 0) > 0 ? (
              <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-slate-700 px-1 text-[10px] font-bold">
                {ctx.openOrdersCount}
              </span>
            ) : null}
          </button>
        ) : (
          <Link
            href="/application/commandes-ouvertes"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-white/10"
          >
            <Package className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Commandes du jour</span>
            {(ctx?.openOrdersCount ?? 0) > 0 ? (
              <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-slate-700 px-1 text-[10px] font-bold">
                {ctx?.openOrdersCount}
              </span>
            ) : null}
          </Link>
        )}
        {ctx?.hasSession ? (
          <button
            type="button"
            onClick={ctx.onCloseSession}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-transparent px-3 py-1.5 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/10"
          >
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Fermer la caisse</span>
          </button>
        ) : null}
        <SignOutButton variant="dark" label="Déconnexion" compact />
      </div>
    </header>
  );
}

function StatusPill({
  label,
  dotClass,
  icon,
}: {
  label: string;
  dotClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300">
      {dotClass ? (
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      ) : (
        icon
      )}
      {label}
    </span>
  );
}
