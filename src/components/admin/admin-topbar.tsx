"use client";

import { Building2, ChevronDown } from "lucide-react";

import { AdminNotificationsBell } from "@/components/admin/admin-notifications-bell";
import { signOutAction } from "@/lib/auth/actions";
import { LiveClock } from "@/components/ui/live-clock";

type AdminTopbarProps = {
  establishmentName: string;
  adminName: string;
  establishmentId: string;
};

export function AdminTopbar({
  establishmentName,
  adminName,
  establishmentId,
}: AdminTopbarProps) {
  const initials =
    adminName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AD";

  return (
    <header className="flex h-11 shrink-0 items-center justify-end gap-2.5 border-b border-slate-200/90 bg-white px-3 lg:h-12 lg:gap-3.5 lg:px-5">
      <div className="mr-auto flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="inline-flex max-w-[220px] items-center gap-2 truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[12px] font-medium text-slate-700 lg:max-w-[280px]"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{establishmentName}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
        <LiveClock className="hidden md:inline-flex" />
      </div>

      <AdminNotificationsBell establishmentId={establishmentId} />

      <form action={signOutAction} className="contents">
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-slate-50"
          title="Déconnexion"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">
            {initials}
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[12px] font-semibold text-slate-900">Admin</span>
            <span className="block text-[11px] text-slate-500">Administrateur</span>
          </span>
        </button>
      </form>
    </header>
  );
}
