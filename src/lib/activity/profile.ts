import {
  BUSINESS_ACTIVITIES,
  isBusinessActivityId,
  isFoodServiceActivity,
  type BusinessActivityId,
} from "@/lib/auth/activities";
import { INVITABLE_SPACES, type UserSpace } from "@/lib/auth/roles";
import { isInvitableSpaceAllowed, type ServiceScope } from "@/lib/settings/service-scope";

export type ActivityKind = "food_service" | "retail";

export type ActivityProfile = {
  id: BusinessActivityId;
  kind: ActivityKind;
  label: string;
  dashboardHint: string;
  productNavLabel: string;
  stockNavLabel: string;
  ticketsNavLabel: string;
  cashierNavLabel: string;
  openTicketsNavLabel: string;
  ordersKpiLabel: string;
  topProductsTitle: string;
  cashierSpaceLabel: string;
  cashierSpaceDescription: string;
  adminSpaceDescription: string;
  catalogDepartmentLabel: string;
  clientPlaceholder: string;
  ticketTitle: string;
};

const FOOD_PROFILE: Omit<ActivityProfile, "id" | "label"> = {
  kind: "food_service",
  dashboardHint: "Vue d’ensemble des ventes, commandes, caisses et stock.",
  productNavLabel: "Produits",
  stockNavLabel: "Stock",
  ticketsNavLabel: "Commandes",
  cashierNavLabel: "Caisse",
  openTicketsNavLabel: "Commandes ouvertes",
  ordersKpiLabel: "Commandes du jour",
  topProductsTitle: "Produits les plus vendus",
  cashierSpaceLabel: "Caisse–Cuisine",
  cashierSpaceDescription: "Commandes, encaissements, reçus et opérations Cuisine.",
  adminSpaceDescription: "Gestion générale de l'établissement et de l'équipe.",
  catalogDepartmentLabel: "Boissons",
  clientPlaceholder: "Table / réf. (ex. T12)",
  ticketTitle: "Commande active",
};

const RETAIL_BASE: Omit<ActivityProfile, "id" | "label"> = {
  kind: "retail",
  dashboardHint: "Chiffre d’affaires, dépenses, bénéfice, stock et équipe.",
  productNavLabel: "Articles",
  stockNavLabel: "Stock",
  ticketsNavLabel: "Tickets",
  cashierNavLabel: "Caisse",
  openTicketsNavLabel: "Tickets ouverts",
  ordersKpiLabel: "Ventes du jour",
  topProductsTitle: "Articles les plus vendus",
  cashierSpaceLabel: "Caissier / Vendeur",
  cashierSpaceDescription: "Ventes, encaissements, reçus et suivi du stock magasin.",
  adminSpaceDescription:
    "Pilotage de l’activité : équipe, stock, dépenses, ventes et bénéfice.",
  catalogDepartmentLabel: "Magasin",
  clientPlaceholder: "Nom du client (optionnel)",
  ticketTitle: "Vente en cours",
};

const RETAIL_OVERRIDES: Partial<
  Record<Exclude<BusinessActivityId, "restaurant">, Partial<Omit<ActivityProfile, "id" | "kind">>>
> = {
  supermarket: {
    dashboardHint: "Rayons, caisse, ruptures et marge du jour.",
    catalogDepartmentLabel: "Rayon",
    cashierSpaceLabel: "Caissier",
    cashierSpaceDescription: "Encaissements, tickets et suivi des rayons.",
  },
  clothing: {
    dashboardHint: "Ventes boutique, collections et encaisse.",
    productNavLabel: "Collections",
    catalogDepartmentLabel: "Boutique",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes, tickets et suivi des collections.",
    clientPlaceholder: "Client / taille (optionnel)",
  },
  phones: {
    dashboardHint: "Téléphones, accessoires, stock et ventes.",
    catalogDepartmentLabel: "Magasin",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes, IMEI / référence client et encaisse.",
    clientPlaceholder: "Client / IMEI (optionnel)",
  },
  pharmacy: {
    dashboardHint: "Officine : ventes, traçabilité stock et caisse.",
    productNavLabel: "Produits",
    catalogDepartmentLabel: "Officine",
    cashierSpaceLabel: "Caissier",
    cashierSpaceDescription: "Délivrance, encaissements et suivi des stocks.",
    clientPlaceholder: "Patient / client (optionnel)",
  },
  cosmetics: {
    dashboardHint: "Beauté : ventes, stock boutique et encaisse.",
    catalogDepartmentLabel: "Boutique",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes, tickets et suivi des produits beauté.",
  },
  "moto-parts": {
    dashboardHint: "Pièces moto, stock magasin et ventes.",
    productNavLabel: "Pièces",
    catalogDepartmentLabel: "Magasin",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes de pièces, tickets et ruptures.",
    clientPlaceholder: "Client / référence pièce (optionnel)",
  },
  "auto-parts": {
    dashboardHint: "Pièces auto, stock magasin et ventes.",
    productNavLabel: "Pièces",
    catalogDepartmentLabel: "Magasin",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes de pièces, tickets et ruptures.",
    clientPlaceholder: "Client / référence pièce (optionnel)",
  },
  vehicles: {
    dashboardHint: "Parc, ventes d’engins et encaisse.",
    productNavLabel: "Engins",
    stockNavLabel: "Parc",
    catalogDepartmentLabel: "Parc",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes d’engins, tickets et suivi du parc.",
    clientPlaceholder: "Acheteur / immatriculation (optionnel)",
  },
  hardware: {
    dashboardHint: "Quincaillerie : articles, stock et caisse.",
    catalogDepartmentLabel: "Magasin",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes, tickets et suivi du magasin.",
  },
  construction: {
    dashboardHint: "Matériaux, dépôt et ventes du jour.",
    productNavLabel: "Matériaux",
    stockNavLabel: "Dépôt",
    catalogDepartmentLabel: "Dépôt",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes de matériaux, tickets et dépôt.",
    clientPlaceholder: "Chantier / client (optionnel)",
  },
  wholesale: {
    dashboardHint: "Distribution : volumes, entrepôt et encaisse.",
    catalogDepartmentLabel: "Entrepôt",
    stockNavLabel: "Entrepôt",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes volume, tickets et suivi d’entrepôt.",
    clientPlaceholder: "Client / bon de livraison (optionnel)",
  },
  other: {
    dashboardHint: "Pilotage des ventes, du stock et de la caisse.",
  },
};

export function getActivityProfile(
  activityCode: string | null | undefined,
): ActivityProfile {
  const id: BusinessActivityId = isBusinessActivityId(activityCode)
    ? activityCode
    : "restaurant";
  const catalog = BUSINESS_ACTIVITIES.find((item) => item.id === id);
  const label = catalog?.label ?? "Restaurant / Maquis / Bar / Buvette";

  if (isFoodServiceActivity(id)) {
    return { id, label, ...FOOD_PROFILE };
  }

  return {
    id,
    label,
    ...RETAIL_BASE,
    ...RETAIL_OVERRIDES[id],
  };
}

export function isRetailActivity(activityCode: string | null | undefined): boolean {
  return getActivityProfile(activityCode).kind === "retail";
}

export function getInvitableSpacesForActivity(
  activityCode: string | null | undefined,
  serviceScope: ServiceScope,
) {
  const profile = getActivityProfile(activityCode);
  return INVITABLE_SPACES.filter((space) => {
    if (profile.kind === "retail" && space.id === "bar_manager") {
      return false;
    }
    return isInvitableSpaceAllowed(space.id, serviceScope);
  }).map((space) => {
    if (space.id === "admin") {
      return { ...space, description: profile.adminSpaceDescription };
    }
    if (space.id === "cashier_kitchen") {
      return {
        ...space,
        label: profile.cashierSpaceLabel,
        description: profile.cashierSpaceDescription,
      };
    }
    return space;
  });
}

export function displaySpaceLabel(
  space: UserSpace,
  activityCode: string | null | undefined,
): string {
  const profile = getActivityProfile(activityCode);
  if (space === "cashier_kitchen") return profile.cashierSpaceLabel;
  if (space === "bar_manager") return "Responsable Bar";
  return "Administration";
}
