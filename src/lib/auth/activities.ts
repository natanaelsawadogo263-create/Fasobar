export const ACTIVITY_COOKIE = "fb_activity";

export const BUSINESS_ACTIVITIES = [
  {
    id: "restaurant",
    label: "Restaurant / Maquis / Bar / Buvette",
    description: "Restauration, maquis, bar et buvette.",
    icon: "utensils",
  },
  {
    id: "supermarket",
    label: "Supermarché / Alimentation",
    description: "Épicerie, produits frais et grande distribution.",
    icon: "store",
  },
  {
    id: "clothing",
    label: "Boutique de vêtements",
    description: "Prêt-à-porter, chaussures et accessoires mode.",
    icon: "shirt",
  },
  {
    id: "phones",
    label: "Téléphones / Ordinateurs / Accessoires",
    description: "Téléphones, ordinateurs, PC et accessoires high-tech.",
    icon: "smartphone",
  },
  {
    id: "pharmacy",
    label: "Pharmacie / Parapharmacie",
    description: "Médicaments, soins et bien-être.",
    icon: "pill",
  },
  {
    id: "cosmetics",
    label: "Cosmétiques",
    description: "Beauté, parfums, soins et maquillage.",
    icon: "sparkles",
  },
  {
    id: "moto-parts",
    label: "Pièces moto",
    description: "Deux-roues, équipement et entretien.",
    icon: "bike",
  },
  {
    id: "auto-parts",
    label: "Pièces auto",
    description: "Pièces détachées et entretien véhicules.",
    icon: "car",
  },
  {
    id: "vehicles",
    label: "Ventes d'engins",
    description: "Motos, voitures et engins motorisés.",
    icon: "truck",
  },
  {
    id: "hardware",
    label: "Quincaillerie",
    description: "Outillage, bricolage et fournitures.",
    icon: "wrench",
  },
  {
    id: "construction",
    label: "Matériaux de construction",
    description: "Ciment, fer, bois et gros œuvre.",
    icon: "brick",
  },
  {
    id: "wholesale",
    label: "Grossiste / Distribution",
    description: "Vente en volume et réseaux B2B.",
    icon: "warehouse",
  },
  {
    id: "other",
    label: "Autre commerce",
    description: "Une activité qui ne figure pas dans la liste.",
    icon: "more",
  },
] as const;

export type BusinessActivityId = (typeof BUSINESS_ACTIVITIES)[number]["id"];

const ACTIVITY_IDS = new Set<string>(BUSINESS_ACTIVITIES.map((item) => item.id));

export function isBusinessActivityId(value: string | null | undefined): value is BusinessActivityId {
  return Boolean(value && ACTIVITY_IDS.has(value));
}

export function isSelectableActivityId(
  value: string | null | undefined,
): value is BusinessActivityId {
  return isBusinessActivityId(value);
}

export function getBusinessActivity(id: string | null | undefined) {
  if (!isBusinessActivityId(id)) return null;
  return BUSINESS_ACTIVITIES.find((item) => item.id === id) ?? null;
}

/** Mapping vers l’enum SQL — sans casser bootstrap_organization. */
export function mapActivityToEstablishmentType(
  activityId: BusinessActivityId,
): "RESTAURANT" | "COMMERCE" {
  if (activityId === "restaurant") return "RESTAURANT";
  return "COMMERCE";
}

export function isFoodServiceActivity(
  activityId: string | null | undefined,
): activityId is "restaurant" {
  return activityId === "restaurant";
}
