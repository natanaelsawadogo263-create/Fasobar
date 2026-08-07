export type PlatformNavItem = {
  href: string;
  label: string;
  enabled: boolean;
};

export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  { href: "/platform", label: "Tableau de bord", enabled: true },
  { href: "/platform/clients", label: "Clients", enabled: true },
  {
    href: "/platform/demandes-abonnement",
    label: "Demandes d’abonnement",
    enabled: true,
  },
  { href: "/platform/abonnements", label: "Abonnements", enabled: true },
  { href: "/platform/machines", label: "Machines", enabled: true },
  { href: "/platform/super-admins", label: "Super Admins", enabled: true },
  { href: "/platform/parametres", label: "Paramètres", enabled: true },
];
