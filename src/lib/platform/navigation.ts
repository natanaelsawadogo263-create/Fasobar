export type PlatformNavItem = {
  href: string;
  label: string;
  enabled: boolean;
};

export const PLATFORM_NAV_ITEMS: PlatformNavItem[] = [
  { href: "/platform", label: "Tableau de bord", enabled: true },
  { href: "/platform/clients", label: "Clients", enabled: true },
  { href: "/platform/demandes", label: "Demandes d’abonnement", enabled: false },
  { href: "/platform/abonnements", label: "Abonnements", enabled: false },
  { href: "/platform/machines", label: "Machines", enabled: false },
  { href: "/platform/super-admins", label: "Super Admins", enabled: false },
  { href: "/platform/parametres", label: "Paramètres", enabled: false },
];
