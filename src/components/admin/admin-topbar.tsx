"use client";

import { Bell, Building2, CalendarDays, ChevronDown } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";

type AdminTopbarProps = {
  establishmentName: string;
  adminName: string;
  notificationCount?: number;
};

export function AdminTopbar({
  establishmentName,
  adminName,
  notificationCount = 0,
}: AdminTopbarProps) {
  const todayLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const initials = adminName
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
        <button
          type="button"
          className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 md:inline-flex"
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="whitespace-nowrap">
            {todayLabel} – {todayLabel}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
      </div>

      <button
        type="button"
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {notificationCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        ) : null}
      </button>

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
