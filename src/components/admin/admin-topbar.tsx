"use client";

import { Building2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { AdminNotificationsBell } from "@/components/admin/admin-notifications-bell";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { EnablePushButton } from "@/components/notifications/enable-push-button";
import { signOutAction } from "@/lib/auth/actions";
import { FullscreenButton } from "@/components/ui/fullscreen-button";
import { LiveClock } from "@/components/ui/live-clock";

type AdminTopbarProps = {
  establishmentName: string;
  adminName: string;
  establishmentId: string;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  roleLabel?: string;
  roleSubtitle?: string;
  showNotifications?: boolean;
};

export function AdminTopbar({
  establishmentName,
  adminName,
  establishmentId,
  sidebarCollapsed = false,
  onToggleSidebar,
  roleLabel = "Admin",
  roleSubtitle = "Administrateur",
  showNotifications = true,
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
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200/90 bg-white px-3 pt-[env(safe-area-inset-top)] md:h-12 md:gap-2.5 md:px-4 lg:px-5">
      {/* Mobile : logo mark + nom établissement */}
      <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
        <FasoBarLogo size="sm" markOnly className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-900">
            {establishmentName}
          </p>
          <p className="truncate text-[10px] text-slate-400">{roleLabel}</p>
        </div>
      </div>

      {/* Desktop : menu + établissement + horloge */}
      <div className="mr-auto hidden min-w-0 items-center gap-2.5 md:flex">
        {onToggleSidebar ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? "Afficher le menu" : "Masquer le menu"}
            aria-label={sidebarCollapsed ? "Afficher le menu" : "Masquer le menu"}
            aria-expanded={!sidebarCollapsed}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4 text-emerald-600" />
            ) : (
              <PanelLeftClose className="h-4 w-4 text-slate-500" />
            )}
            <span className="hidden lg:inline">
              {sidebarCollapsed ? "Menu" : "Masquer"}
            </span>
          </button>
        ) : null}

        <div className="inline-flex min-w-0 max-w-[280px] items-center gap-2 truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[12px] font-medium text-slate-700">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{establishmentName}</span>
        </div>
        <LiveClock />
      </div>

      <div className="hidden md:block">
        <FullscreenButton />
      </div>

      {showNotifications ? <EnablePushButton /> : null}

      {showNotifications ? (
        <AdminNotificationsBell establishmentId={establishmentId} />
      ) : null}

      <form action={signOutAction} className="shrink-0">
        <button
          type="submit"
          className="flex h-11 items-center gap-2 rounded-xl px-0.5 text-left active:bg-slate-50 md:h-auto md:rounded-lg md:px-1 md:py-0.5 md:hover:bg-slate-50"
          title="Déconnexion"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-[12px] font-bold text-emerald-800 md:h-8 md:w-8 md:text-[11px]">
            {initials}
          </span>
          <span className="hidden leading-tight lg:block">
            <span className="block text-[12px] font-semibold text-slate-900">{roleLabel}</span>
            <span className="block text-[11px] text-slate-500">{roleSubtitle}</span>
          </span>
        </button>
      </form>
    </header>
  );
}
