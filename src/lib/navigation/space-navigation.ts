import { getActivityProfile, isRetailActivity } from "@/lib/activity/profile";
import type { UserSpace } from "@/lib/auth/roles";
import {
  hasBarService,
  hasKitchenService,
  isPathAllowedForServiceScope,
  type ServiceScope,
} from "@/lib/settings/service-scope";

export type NavItem = {
  href: string;
  label: string;
  enabled: boolean;
};

/** Lien d'accueil (maison) — à mettre en avant dans la navigation. */
export function isHomeNavItem(item: Pick<NavItem, "href" | "label">): boolean {
  if (item.label === "Tableau de bord" || item.label === "Accueil") return true;
  return (
    item.href === "/application/tableau-de-bord" ||
    item.href === "/application/bar" ||
    item.href === "/application/caisse" ||
    item.href === "/application" ||
    item.href === "/platform"
  );
}

export const ADMIN_NAV: NavItem[] = [
  { href: "/application/tableau-de-bord", label: "Tableau de bord", enabled: true },
  { href: "/application/produits", label: "Produits", enabled: true },
  { href: "/application/stock", label: "Stock", enabled: true },
  { href: "/application/approvisionnements", label: "Approvisionnements", enabled: true },
  { href: "/application/depenses", label: "Dépenses", enabled: true },
  { href: "/application/ventes", label: "Ventes", enabled: true },
  { href: "/application/commandes", label: "Commandes", enabled: true },
  { href: "/application/caisses", label: "Caisses", enabled: true },
  { href: "/application/sessions-bar", label: "Sessions Bar", enabled: true },
  { href: "/application/utilisateurs", label: "Utilisateurs", enabled: true },
  { href: "/application/rapports", label: "Rapports", enabled: true },
  { href: "/application/mon-abonnement", label: "Mon abonnement", enabled: true },
  { href: "/application/parametres", label: "Paramètres", enabled: true },
];

export const CASHIER_KITCHEN_NAV: NavItem[] = [
  { href: "/application/caisse", label: "Caisse", enabled: true },
  { href: "/application/commandes-ouvertes", label: "Commandes ouvertes", enabled: true },
  { href: "/application/cuisine", label: "Cuisine", enabled: true },
  { href: "/application/stock/cuisine", label: "Stock Cuisine", enabled: true },
  { href: "/application/approvisionnements", label: "Approvisionnements", enabled: true },
  { href: "/application/depenses", label: "Dépenses", enabled: true },
  { href: "/application/caisse/session", label: "Ma session", enabled: true },
];

export const BAR_MANAGER_NAV: NavItem[] = [
  { href: "/application/bar", label: "Tableau de bord", enabled: true },
  { href: "/application/bar/commandes", label: "Commandes boissons", enabled: true },
  { href: "/application/bar/stock", label: "Stock boissons", enabled: true },
  { href: "/application/bar/approvisionnements", label: "Approvisionnements", enabled: true },
  { href: "/application/depenses", label: "Dépenses", enabled: true },
  { href: "/application/bar/historique", label: "Historique", enabled: true },
  { href: "/application/bar/session", label: "Ma session", enabled: true },
];

export function getNavigationForSpace(
  space: UserSpace,
  serviceScope: ServiceScope = "BOTH",
  activityCode?: string | null,
): NavItem[] {
  const profile = getActivityProfile(activityCode);
  const retail = profile.kind === "retail";

  if (retail && space === "admin") {
    return [
      { href: "/application/tableau-de-bord", label: "Accueil", enabled: true },
      { href: "/application/produits", label: profile.productNavLabel, enabled: true },
      { href: "/application/stock", label: profile.stockNavLabel, enabled: true },
      { href: "/application/approvisionnements", label: "Approvisionnements", enabled: true },
      { href: "/application/ventes", label: "Ventes", enabled: true },
      { href: "/application/caisses", label: "Caisses", enabled: true },
      { href: "/application/depenses", label: "Dépenses", enabled: true },
      { href: "/application/utilisateurs", label: "Utilisateurs", enabled: true },
      { href: "/application/rapports", label: "Rapports", enabled: true },
      { href: "/application/parametres", label: "Paramètres", enabled: true },
    ];
  }

  if (retail && space === "cashier_kitchen") {
    return [
      { href: "/application/caisse", label: profile.cashierNavLabel, enabled: true },
      {
        href: "/application/commandes-ouvertes",
        label: profile.openTicketsNavLabel,
        enabled: true,
      },
      { href: "/application/caisse/session", label: "Ma session", enabled: true },
    ];
  }

  if (retail && space === "bar_manager") {
    return [
      { href: "/application/stock", label: "Accueil", enabled: true },
      { href: "/application/produits", label: profile.productNavLabel, enabled: true },
      { href: "/application/approvisionnements", label: "Approvisionnements", enabled: true },
      { href: "/application/depenses", label: "Dépenses", enabled: true },
    ];
  }

  const items = (() => {
    switch (space) {
      case "cashier_kitchen":
        return CASHIER_KITCHEN_NAV;
      case "bar_manager":
        return BAR_MANAGER_NAV;
      default:
        return ADMIN_NAV;
    }
  })();

  return items
    .filter((item) => {
      if (item.href === "/application/sessions-bar") {
        return !retail && hasBarService(serviceScope);
      }
      if (item.href === "/application/cuisine" || item.href === "/application/stock/cuisine") {
        return !retail && hasKitchenService(serviceScope);
      }
      // Commerce : l’historique des tickets est côté Ventes, pas une page dédiée.
      if (retail && item.href === "/application/commandes") {
        return false;
      }
      return true;
    })
    .map((item) => {
      if (!retail || space !== "admin") return item;
      if (item.href === "/application/produits") {
        return { ...item, label: profile.productNavLabel };
      }
      if (item.href === "/application/stock") {
        return { ...item, label: profile.stockNavLabel };
      }
      return item;
    });
}

const ADMIN_ONLY_PREFIXES = [
  "/application/utilisateurs",
  "/application/tableau-de-bord",
  "/application/parametres",
  "/application/mon-abonnement",
  "/application/rapports",
  "/application/ventes",
  "/application/caisses",
  "/application/sessions-bar",
];

const CASHIER_PREFIXES = [
  "/application/caisse",
  "/application/commandes-ouvertes",
  "/application/commandes/",
  "/application/encaissement",
  "/application/recus",
  "/application/cuisine",
];

const BAR_PREFIXES = ["/application/bar"];

const SHARED_PREFIXES = [
  "/application/stock/cuisine",
  "/application/inventaires",
  "/application/depenses",
  "/application/approvisionnements",
];

export function isPathAllowedForSpace(
  pathname: string,
  space: UserSpace,
  serviceScope: ServiceScope = "BOTH",
  activityCode?: string | null,
): boolean {
  const retail = isRetailActivity(activityCode);

  if (retail) {
    if (
      pathname.startsWith("/application/sessions-bar") ||
      pathname.startsWith("/application/bar") ||
      pathname.startsWith("/application/cuisine") ||
      pathname.startsWith("/application/stock/cuisine")
    ) {
      return false;
    }

    if (space === "admin") {
      if (pathname === "/application/commandes") {
        return false;
      }
      return pathname.startsWith("/application");
    }

    if (space === "cashier_kitchen") {
      if (
        pathname.startsWith("/application/utilisateurs") ||
        pathname.startsWith("/application/parametres") ||
        pathname.startsWith("/application/rapports") ||
        pathname.startsWith("/application/caisses") ||
        pathname.startsWith("/application/ventes") ||
        pathname.startsWith("/application/produits") ||
        pathname.startsWith("/application/stock") ||
        pathname.startsWith("/application/approvisionnements") ||
        pathname.startsWith("/application/depenses") ||
        pathname.startsWith("/application/mon-abonnement")
      ) {
        return false;
      }
      return (
        pathname.startsWith("/application/caisse") ||
        pathname.startsWith("/application/commandes-ouvertes") ||
        pathname.startsWith("/application/commandes/") ||
        pathname.startsWith("/application/encaissement") ||
        pathname.startsWith("/application/recus") ||
        pathname === "/application" ||
        pathname.startsWith("/application/mode-hors-connexion")
      );
    }

    if (space === "bar_manager") {
      if (
        pathname.startsWith("/application/caisse") ||
        pathname.startsWith("/application/encaissement") ||
        pathname.startsWith("/application/commandes-ouvertes") ||
        pathname.startsWith("/application/utilisateurs") ||
        pathname.startsWith("/application/parametres") ||
        pathname.startsWith("/application/rapports") ||
        pathname.startsWith("/application/caisses") ||
        pathname.startsWith("/application/ventes") ||
        pathname.startsWith("/application/mon-abonnement") ||
        pathname.startsWith("/application/inventaires")
      ) {
        return false;
      }
      return (
        pathname.startsWith("/application/stock") ||
        pathname.startsWith("/application/produits") ||
        pathname.startsWith("/application/approvisionnements") ||
        pathname.startsWith("/application/depenses") ||
        pathname === "/application" ||
        pathname.startsWith("/application/mode-hors-connexion")
      );
    }
  }

  if (retail) {
    if (
      pathname.startsWith("/application/sessions-bar") ||
      pathname.startsWith("/application/bar") ||
      pathname.startsWith("/application/cuisine") ||
      pathname.startsWith("/application/stock/cuisine")
    ) {
      return false;
    }
  }

  if (!retail && !isPathAllowedForServiceScope(pathname, serviceScope)) {
    return false;
  }

  if (space === "admin") {
    // Admin : supervision — pas d'usage opérationnel de la caisse / cuisine.
    if (
      pathname === "/application/caisse" ||
      pathname.startsWith("/application/caisse/") ||
      pathname.startsWith("/application/encaissement") ||
      pathname === "/application/commandes-ouvertes" ||
      pathname.startsWith("/application/commandes-ouvertes/") ||
      pathname === "/application/cuisine" ||
      pathname.startsWith("/application/cuisine/")
    ) {
      return false;
    }

    // Commerce : liste Tickets remplacée par Ventes (détail /application/commandes/:id OK).
    if (retail && pathname === "/application/commandes") {
      return false;
    }

    return pathname.startsWith("/application");
  }

  if (space === "cashier_kitchen") {
    if (BAR_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return false;
    }

    if (ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return false;
    }

    if (pathname === "/application/commandes") {
      return false;
    }

    if (pathname.startsWith("/application/produits")) {
      return false;
    }

    if (
      pathname.startsWith("/application/stock") &&
      !pathname.startsWith("/application/stock/cuisine") &&
      !retail
    ) {
      return false;
    }

    return (
      CASHIER_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      SHARED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      (retail && pathname.startsWith("/application/stock")) ||
      pathname === "/application" ||
      pathname.startsWith("/application/mode-hors-connexion")
    );
  }

  if (space === "bar_manager") {
    if (CASHIER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return false;
    }

    if (ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return false;
    }

    if (pathname.startsWith("/application/stock")) {
      return false;
    }

    if (pathname.startsWith("/application/produits")) {
      return false;
    }

    // Admin /application/approvisionnements : pas pour le Bar (il a /bar/approvisionnements).
    // Caisse–Cuisine y accède via SHARED_PREFIXES (cuisine uniquement).
    if (pathname.startsWith("/application/approvisionnements")) {
      return false;
    }

    if (pathname.startsWith("/application/inventaires")) {
      return false;
    }

    if (
      pathname === "/application/bar/operations" ||
      pathname.startsWith("/application/bar/operations/")
    ) {
      return false;
    }

    if (pathname.startsWith("/application/encaissement") || pathname.startsWith("/application/recus")) {
      return false;
    }

    return (
      BAR_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      SHARED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      pathname === "/application" ||
      pathname.startsWith("/application/mode-hors-connexion")
    );
  }

  return false;
}
