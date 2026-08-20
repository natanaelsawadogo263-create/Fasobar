"use client";

import { InstantLink } from "@/components/layout/instant-link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import {
  Boxes,
  ClipboardList,
  CreditCard,
  GlassWater,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  BarChart3,
  Wallet,
  Landmark,
  X,
  Clock3,
  Timer,
  UtensilsCrossed,
  Fuel,
} from "lucide-react";

import { isHomeNavItem, type NavItem } from "@/lib/navigation/space-navigation";

const NAV_ICONS: Record<
  string,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  "/application/tableau-de-bord": LayoutDashboard,
  "/application/produits": Package,
  "/application/stock": Boxes,
  "/application/approvisionnements": Truck,
  "/application/depenses": Wallet,
  "/application/ventes": ShoppingBag,
  "/application/commandes": ClipboardList,
  "/application/caisses": Landmark,
  "/application/sessions-bar": GlassWater,
  "/application/utilisateurs": Users,
  "/application/rapports": BarChart3,
  "/application/mon-abonnement": CreditCard,
  "/application/parametres": Settings,
  "/application/bar": LayoutDashboard,
  "/application/bar/commandes": GlassWater,
  "/application/bar/stock": Package,
  "/application/bar/approvisionnements": Truck,
  "/application/bar/historique": Clock3,
  "/application/bar/session": Timer,
  "/application/caisse": ShoppingBag,
  "/application/caisse/session": Timer,
  "/application/commandes-ouvertes": ClipboardList,
  "/application/cuisine": UtensilsCrossed,
  "/application/station": LayoutDashboard,
  "/application/station/employes": Users,
  "/application/station/sessions": Clock3,
  "/application/station/bilans": BarChart3,
  "/application/station/parametres": Settings,
  "/application/station/pompiste": Fuel,
  "/application/station/pompiste/session": Timer,
};

function shortLabel(label: string): string {
  if (label === "Tableau de bord") return "Accueil";
  if (label === "Approvisionnements") return "Appro";
  if (label === "Mon abonnement") return "Abo";
  if (label === "Sessions Bar") return "Sessions";
  if (label === "Commandes boissons") return "Commandes";
  if (label === "Stock boissons") return "Stock";
  if (label === "Commandes ouvertes") return "Ouvertes";
  if (label === "Mes ventes") return "Ventes";
  if (label === "Ma session") return "Session";
  if (label === "Employés") return "Employés";
  if (label === "Sessions") return "Sessions";
  if (label === "Bilans") return "Bilans";
  if (label === "Paramètres") return "Réglages";
  if (label === "Ma pompe") return "Pompe";
  if (label === "Stock Cuisine") return "Stock";
  return label;
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/application/station") {
    return pathname === "/application/station";
  }
  if (href === "/application/station/pompiste") {
    return pathname === "/application/station/pompiste";
  }
  if (href === "/application/station/pompiste/session") {
    return (
      pathname === "/application/station/pompiste/session" ||
      pathname.startsWith("/application/station/pompiste/session/")
    );
  }
  if (href === "/application/bar") return pathname === "/application/bar";
  if (href === "/application/caisse") {
    return pathname === "/application/caisse" || pathname.startsWith("/application/caisse/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type MobileNavProps = {
  items: NavItem[];
  /** Hrefs des 4 onglets principaux (le 5ᵉ est « Plus »). */
  primaryHrefs: string[];
  tone?: "admin" | "bar";
};

export function MobileNav({
  items,
  primaryHrefs,
  tone: _tone = "admin",
}: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const enabled = useMemo(
    () => items.filter((item) => item.enabled),
    [items],
  );

  const primary = useMemo(() => {
    const byHref = new Map(enabled.map((item) => [item.href, item]));
    return primaryHrefs
      .map((href) => byHref.get(href))
      .filter((item): item is NavItem => Boolean(item))
      .slice(0, 4);
  }, [enabled, primaryHrefs]);

  const primarySet = useMemo(
    () => new Set(primary.map((item) => item.href)),
    [primary],
  );

  const moreActive = enabled.some(
    (item) => !primarySet.has(item.href) && isActivePath(pathname, item.href),
  );

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <nav
        className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 backdrop-blur-md md:hidden"
        aria-label="Navigation principale"
      >
        <div className="mx-auto flex min-h-[3.75rem] max-w-lg items-stretch px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          {primary.map((item) => {
            const Icon = NAV_ICONS[item.href] ?? Package;
            const active = isActivePath(pathname, item.href);
            return (
              <InstantLink
                key={item.href}
                href={item.href}
                prefetch
                className={`relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition ${
                  active
                    ? "text-emerald-700"
                    : "text-slate-500 active:text-slate-800"
                }`}
              >
                {active ? (
                  <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-emerald-500" />
                ) : null}
                <Icon
                  className={`h-5 w-5 ${active ? "text-emerald-600" : ""}`}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className="max-w-full truncate">{shortLabel(item.label)}</span>
              </InstantLink>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition ${
              moreActive || open
                ? "text-emerald-700"
                : "text-slate-500 active:text-slate-800"
            }`}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            {moreActive ? (
              <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-emerald-500" />
            ) : null}
            <MoreHorizontal
              className={`h-5 w-5 ${moreActive || open ? "text-emerald-600" : ""}`}
              strokeWidth={moreActive || open ? 2.4 : 2}
            />
            <span>Plus</span>
          </button>
        </div>
      </nav>

      {open ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-3">
              <div className="min-w-0">
                <p id={titleId} className="text-[15px] font-bold text-slate-900">
                  Menu FasoBar
                </p>
                <p className="text-[12px] text-slate-500">Tous les écrans</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:bg-slate-200"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="app-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-3 gap-2">
                {enabled.map((item) => {
                  const Icon = NAV_ICONS[item.href] ?? Package;
                  const active = isActivePath(pathname, item.href);
                  const home = isHomeNavItem(item);
                  return (
                    <InstantLink
                      key={item.href}
                      href={item.href}
                      prefetch
                      onClick={() => setOpen(false)}
                      className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition active:scale-[0.98] ${
                        active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : home
                            ? "border-emerald-100 bg-emerald-50/60 text-emerald-900"
                            : "border-slate-200 bg-slate-50/80 text-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                          active || home
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-slate-600 shadow-sm"
                        }`}
                      >
                        <Icon className="h-5 w-5" strokeWidth={2.2} />
                      </span>
                      <span className="text-[11px] font-semibold leading-tight">
                        {shortLabel(item.label)}
                      </span>
                    </InstantLink>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
