import {
  BUSINESS_ACTIVITIES,
  isBusinessActivityId,
  isFoodServiceActivity,
  type BusinessActivityId,
} from "@/lib/auth/activities";
import { isRetailShopOps } from "@/lib/activity/ops-model";
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
  stockManagerLabel: string;
  stockManagerDescription: string;
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
  cashierSpaceLabel: "Cuisine",
  cashierSpaceDescription: "Commandes cuisine, préparation et opérations Cuisine.",
  stockManagerLabel: "Bar",
  stockManagerDescription: "Commandes boissons, stock Bar, pertes et inventaires.",
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
  ticketsNavLabel: "Ventes",
  cashierNavLabel: "Vente",
  openTicketsNavLabel: "Mes ventes",
  ordersKpiLabel: "Ventes du jour",
  topProductsTitle: "Articles les plus vendus",
  cashierSpaceLabel: "Caissier / Vendeur",
  cashierSpaceDescription: "Vente, encaissement et session de caisse uniquement.",
  stockManagerLabel: "Responsable Stock",
  stockManagerDescription:
    "Catalogue, stock, réceptions fournisseurs et dépenses d’approvisionnement.",
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
    dashboardHint: "Caisse, rayons, ruptures et marge du magasin.",
    productNavLabel: "Produits",
    stockNavLabel: "Stock",
    ticketsNavLabel: "Tickets",
    cashierNavLabel: "Caisse",
    openTicketsNavLabel: "Tickets",
    ordersKpiLabel: "Tickets du jour",
    topProductsTitle: "Produits les plus vendus",
    catalogDepartmentLabel: "Magasin",
    cashierSpaceLabel: "Caissier",
    cashierSpaceDescription:
      "Caisse, tickets et encaissement — le stock est géré à part.",
    stockManagerLabel: "Responsable magasin",
    stockManagerDescription:
      "Produits, rayons, réceptions fournisseurs et niveaux de stock.",
    adminSpaceDescription:
      "Pilotage du magasin : équipe, stock, caisse, ventes et bénéfice.",
    clientPlaceholder: "Client (optionnel)",
    ticketTitle: "Ticket en cours",
  },
  clothing: {
    dashboardHint: "Ventes boutique, collections et encaisse.",
    productNavLabel: "Collections",
    catalogDepartmentLabel: "Boutique",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes et tickets — le stock boutique est géré à part.",
    clientPlaceholder: "Client / taille (optionnel)",
    stockManagerLabel: "Responsable boutique",
    stockManagerDescription: "Collections, réceptions et stock boutique.",
  },
  phones: {
    dashboardHint: "Téléphones, PC, accessoires, stock et ventes.",
    catalogDepartmentLabel: "Magasin",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes high-tech, IMEI / n° de série et encaisse.",
    clientPlaceholder: "Client / IMEI (optionnel)",
    stockManagerLabel: "Responsable Stock",
    stockManagerDescription:
      "Téléphones, ordinateurs, PC, accessoires, réceptions et traçabilité.",
  },
  pharmacy: {
    dashboardHint: "Officine : ventes, traçabilité stock et caisse.",
    productNavLabel: "Produits",
    catalogDepartmentLabel: "Officine",
    cashierSpaceLabel: "Caissier",
    cashierSpaceDescription: "Délivrance et encaissements — le stock officine est géré à part.",
    clientPlaceholder: "Patient / client (optionnel)",
    stockManagerLabel: "Responsable officine",
    stockManagerDescription: "Catalogue, lots, réceptions et stock officine.",
  },
  cosmetics: {
    dashboardHint: "Beauté : ventes, stock boutique et encaisse.",
    catalogDepartmentLabel: "Boutique",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes et tickets — le stock est géré à part.",
    stockManagerLabel: "Responsable boutique",
    stockManagerDescription: "Catalogue beauté, réceptions et stock.",
  },
  "moto-parts": {
    dashboardHint: "Pièces moto, stock magasin et ventes.",
    productNavLabel: "Pièces",
    catalogDepartmentLabel: "Magasin",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes de pièces et encaisse.",
    clientPlaceholder: "Client / référence pièce (optionnel)",
    stockManagerLabel: "Responsable Stock",
    stockManagerDescription: "Pièces, références, réceptions et ruptures.",
  },
  "auto-parts": {
    dashboardHint: "Pièces auto, stock magasin et ventes.",
    productNavLabel: "Pièces",
    catalogDepartmentLabel: "Magasin",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes de pièces et encaisse.",
    clientPlaceholder: "Client / référence pièce (optionnel)",
    stockManagerLabel: "Responsable Stock",
    stockManagerDescription: "Pièces, références, réceptions et ruptures.",
  },
  vehicles: {
    dashboardHint: "Parc, ventes d’engins et encaisse.",
    productNavLabel: "Engins",
    stockNavLabel: "Parc",
    catalogDepartmentLabel: "Parc",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes d’engins et encaisse.",
    clientPlaceholder: "Acheteur / immatriculation (optionnel)",
    stockManagerLabel: "Responsable parc",
    stockManagerDescription: "Parc, réceptions et suivi des engins.",
  },
  hardware: {
    dashboardHint: "Ventes, stock et caisse — tout le magasin d’un coup d’œil.",
    productNavLabel: "Produits",
    stockNavLabel: "Stock",
    ticketsNavLabel: "Ventes",
    cashierNavLabel: "Vente",
    openTicketsNavLabel: "Mes ventes",
    catalogDepartmentLabel: "Magasin",
    cashierSpaceLabel: "Caisse-Vendeur",
    cashierSpaceDescription:
      "Vente, encaissement, session de caisse et règlements clients.",
    stockManagerLabel: "Responsable Stock",
    stockManagerDescription:
      "Catalogue, stock, réceptions et dépenses d’approvisionnement.",
    adminSpaceDescription:
      "Pilotage complet : catalogue, stock, caisses, crédits, fournisseurs et équipe.",
    clientPlaceholder: "Client enregistré",
    ticketTitle: "Vente en cours",
  },
  construction: {
    dashboardHint: "Matériaux, dépôt et ventes du jour.",
    productNavLabel: "Matériaux",
    stockNavLabel: "Dépôt",
    catalogDepartmentLabel: "Dépôt",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes de matériaux et encaisse.",
    clientPlaceholder: "Chantier / client (optionnel)",
    stockManagerLabel: "Responsable dépôt",
    stockManagerDescription: "Matériaux, conversions d’unités, réceptions et dépôt.",
  },
  wholesale: {
    dashboardHint: "Distribution : volumes, entrepôt et encaisse.",
    catalogDepartmentLabel: "Entrepôt",
    stockNavLabel: "Entrepôt",
    cashierSpaceLabel: "Vendeur",
    cashierSpaceDescription: "Ventes volume et encaisse.",
    clientPlaceholder: "Client / bon de livraison (optionnel)",
    stockManagerLabel: "Responsable entrepôt",
    stockManagerDescription: "Volumes, cartons, réceptions et entrepôt.",
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
    if (space.id === "bar_manager") {
      if (isRetailShopOps(activityCode)) return true;
      if (profile.kind === "retail") return false;
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
    if (space.id === "bar_manager") {
      return {
        ...space,
        label: profile.stockManagerLabel,
        description: profile.stockManagerDescription,
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
  if (space === "bar_manager") {
    return profile.stockManagerLabel;
  }
  return "Administration";
}
