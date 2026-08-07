import type { UserSpace } from "@/lib/auth/roles";

export type NavItem = {
  href: string;
  label: string;
  enabled: boolean;
};

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
  { href: "/application/caisse/session", label: "Ma session", enabled: true },
];

export const BAR_MANAGER_NAV: NavItem[] = [
  { href: "/application/bar", label: "Tableau de bord", enabled: true },
  { href: "/application/bar/commandes", label: "Commandes boissons", enabled: true },
  { href: "/application/bar/stock", label: "Stock boissons", enabled: true },
  { href: "/application/bar/approvisionnements", label: "Approvisionnements", enabled: true },
  { href: "/application/bar/historique", label: "Historique", enabled: true },
  { href: "/application/bar/session", label: "Ma session", enabled: true },
];

export function getNavigationForSpace(space: UserSpace): NavItem[] {
  switch (space) {
    case "cashier_kitchen":
      return CASHIER_KITCHEN_NAV;
    case "bar_manager":
      return BAR_MANAGER_NAV;
    default:
      return ADMIN_NAV;
  }
}

const ADMIN_ONLY_PREFIXES = [
  "/application/utilisateurs",
  "/application/tableau-de-bord",
  "/application/parametres",
  "/application/mon-abonnement",
  "/application/rapports",
  "/application/ventes",
  "/application/depenses",
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

const SHARED_PREFIXES = ["/application/stock/cuisine", "/application/inventaires"];

export function isPathAllowedForSpace(pathname: string, space: UserSpace): boolean {
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

    if (pathname.startsWith("/application/stock") && !pathname.startsWith("/application/stock/cuisine")) {
      return false;
    }

    return (
      CASHIER_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      SHARED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      pathname === "/application"
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
      pathname === "/application"
    );
  }

  return false;
}
