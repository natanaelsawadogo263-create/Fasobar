"use client";

import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Boxes, History, Inbox, Menu, Truck, UserRound, X } from "lucide-react";

import { SignOutForm } from "@/components/auth/sign-out-form";
import { InstantLink } from "@/components/layout/instant-link";
import { FullscreenButton } from "@/components/ui/fullscreen-button";
import { LiveClock } from "@/components/ui/live-clock";
import { useDeliveryOrdersLive } from "@/hooks/use-delivery-orders-live";
import type { NavItem } from "@/lib/navigation/space-navigation";
import { createClient } from "@/lib/supabase/client";

type CourierShellProps = {
  establishmentId: string;
  establishmentName: string;
  userId: string;
  courierName?: string;
  navItems: NavItem[];
  children: ReactNode;
};

type CourierCounts = { pending: number; mine: number };

const COURIER_HOME = "/application/livreur";

const NAV_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "/application/livreur": Inbox,
  "/application/livreur/en-cours": Truck,
  "/application/livreur/historique": History,
  "/application/livreur/stock": Boxes,
};

function isActive(pathname: string, href: string): boolean {
  if (href === COURIER_HOME) return pathname === COURIER_HOME;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Espace livreur (e-commerce) : menu burger (tiroir) sur mobile, menu fixe sur
 * grand écran. La réception des commandes en direct (signal sonore) est active
 * sur toutes les pages du livreur.
 */
export function CourierShell({
  establishmentId,
  establishmentName,
  userId,
  courierName = "Livreur",
  navItems,
  children,
}: CourierShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [counts, setCounts] = useState<CourierCounts>({ pending: 0, mine: 0 });

  const refreshCounts = useCallback(async () => {
    if (!establishmentId || !userId) return;
    const supabase = createClient();
    const [pending, mine] = await Promise.all([
      supabase
        .from("delivery_orders")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .eq("status", "PENDING"),
      supabase
        .from("delivery_orders")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .eq("status", "ACCEPTED")
        .eq("courier_id", userId),
    ]);
    setCounts({ pending: pending.count ?? 0, mine: mine.count ?? 0 });
  }, [establishmentId, userId]);

  useDeliveryOrdersLive(establishmentId, { chimeOnNew: true, onChange: refreshCounts });

  // Compteurs à jour après chaque navigation (acceptation, livraison…).
  useEffect(() => {
    const timer = setTimeout(() => void refreshCounts(), 0);
    return () => clearTimeout(timer);
  }, [refreshCounts, pathname]);

  // Le tiroir se ferme dès qu'on change de page.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const badgeFor = (href: string): number | null => {
    if (href === COURIER_HOME) return counts.pending;
    if (href === "/application/livreur/en-cours") return counts.mine;
    return null;
  };

  const currentLabel =
    navItems.find((item) => isActive(pathname, item.href))?.label ?? "Espace livreur";

  const nav = (
    <CourierNav
      items={navItems}
      pathname={pathname}
      badgeFor={badgeFor}
      courierName={courierName}
      establishmentName={establishmentName}
    />
  );

  return (
    <div className="courier-shell app-shell flex h-dvh w-full max-w-full overflow-hidden bg-[#f4f6f8]">
      <aside className="hidden h-full w-64 shrink-0 border-r border-slate-200 bg-white lg:flex">{nav}</aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white px-3 pt-[env(safe-area-inset-top)] md:gap-3 md:px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition active:bg-slate-50 md:h-9 md:w-9 md:rounded-lg md:hover:bg-slate-50 lg:hidden"
          >
            <Menu className="h-5 w-5" />
            {counts.pending > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {counts.pending}
              </span>
            ) : null}
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-slate-900">{currentLabel}</p>
            <p className="truncate text-[11px] text-slate-400">{establishmentName}</p>
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

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-slate-900/50"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu livreur"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-white shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Fermer le menu"
              className="absolute right-2 top-[calc(0.5rem+env(safe-area-inset-top))] inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function CourierNav({
  items,
  pathname,
  badgeFor,
  courierName,
  establishmentName,
}: {
  items: NavItem[];
  pathname: string;
  badgeFor: (href: string) => number | null;
  courierName: string;
  establishmentName: string;
}) {
  return (
    <div className="flex h-full w-full flex-col pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Truck className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 pr-8 lg:pr-0">
          <p className="truncate text-[14px] font-bold text-slate-900">Espace livreur</p>
          <p className="truncate text-[11px] text-slate-500">{establishmentName}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Navigation livreur">
        {items
          .filter((item) => item.enabled)
          .map((item) => {
            const Icon = NAV_ICONS[item.href] ?? Inbox;
            const active = isActive(pathname, item.href);
            const badge = badgeFor(item.href);
            return (
              <InstantLink
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition ${
                  active
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-slate-400"}`} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {badge !== null && badge > 0 ? (
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                      active ? "bg-white/25 text-white" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </InstantLink>
            );
          })}
      </nav>

      <div className="border-t border-slate-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-900">{courierName}</p>
            <p className="truncate text-[11px] text-slate-500">Livreur</p>
          </div>
        </div>
      </div>
    </div>
  );
}
