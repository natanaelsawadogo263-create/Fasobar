export type PlatformNavBadgeKey = "opening" | "subscription";

export type PlatformNavItem = {
  href: string;
  label: string;
  /** Libellé court barre mobile */
  shortLabel?: string;
  enabled: boolean;
  badgeKey?: PlatformNavBadgeKey;
};

export type PlatformNavSection = {
  id: string;
  label: string;
  items: PlatformNavItem[];
};

export type PlatformNavBadges = {
  openingRequests: number;
  subscriptionRequests: number;
};

export const PLATFORM_NAV_SECTIONS: PlatformNavSection[] = [
  {
    id: "pilotage",
    label: "Pilotage",
    items: [
      {
        href: "/platform",
        label: "Tableau de bord",
        shortLabel: "Accueil",
        enabled: true,
      },
    ],
  },
  {
    id: "queue",
    label: "À traiter",
    items: [
      {
        href: "/platform/demandes-etablissement",
        label: "Ouvertures",
        shortLabel: "Ouvertures",
        enabled: true,
        badgeKey: "opening",
      },
      {
        href: "/platform/demandes-abonnement",
        label: "Paiements",
        shortLabel: "Paiements",
        enabled: true,
        badgeKey: "subscription",
      },
    ],
  },
  {
    id: "portfolio",
    label: "Portefeuille",
    items: [
      {
        href: "/platform/clients",
        label: "Clients",
        shortLabel: "Clients",
        enabled: true,
      },
      {
        href: "/platform/abonnements",
        label: "Abonnements",
        shortLabel: "Abos",
        enabled: true,
      },
    ],
  },
  {
    id: "platform",
    label: "Plateforme",
    items: [
      {
        href: "/platform/machines",
        label: "Machines",
        shortLabel: "Machines",
        enabled: true,
      },
      {
        href: "/platform/super-admins",
        label: "Super Admins",
        shortLabel: "Admins",
        enabled: true,
      },
      {
        href: "/platform/parametres",
        label: "Paramètres",
        shortLabel: "Réglages",
        enabled: true,
      },
    ],
  },
];

/** Liste plate — compatibilité (topbar, prefetch). */
export const PLATFORM_NAV_ITEMS: PlatformNavItem[] =
  PLATFORM_NAV_SECTIONS.flatMap((section) => section.items);

export type PlatformPageMeta = {
  sectionLabel: string | null;
  title: string;
};

export function resolvePlatformPageMeta(pathname: string): PlatformPageMeta {
  if (pathname === "/platform") {
    const item = PLATFORM_NAV_SECTIONS[0]!.items[0]!;
    return {
      sectionLabel: PLATFORM_NAV_SECTIONS[0]!.label,
      title: item.label,
    };
  }

  if (pathname.startsWith("/platform/clients/")) {
    return {
      sectionLabel: "Portefeuille",
      title: "Fiche client",
    };
  }

  for (const section of PLATFORM_NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.href === "/platform") continue;
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return {
          sectionLabel: section.label,
          title: item.label,
        };
      }
    }
  }

  return {
    sectionLabel: null,
    title: "Espace plateforme",
  };
}

export function badgeCountForItem(
  item: PlatformNavItem,
  badges: PlatformNavBadges,
): number {
  if (item.badgeKey === "opening") return badges.openingRequests;
  if (item.badgeKey === "subscription") return badges.subscriptionRequests;
  return 0;
}

export function totalPendingActions(badges: PlatformNavBadges): number {
  return badges.openingRequests + badges.subscriptionRequests;
}
