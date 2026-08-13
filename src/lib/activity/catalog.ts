import { getActivityProfile, isRetailActivity } from "@/lib/activity/profile";
import type { BusinessActivityId } from "@/lib/auth/activities";
import { CAISSE_CATEGORIES } from "@/lib/caisse/catalog";
import type { ProductUnit } from "@/lib/products/schemas";

export type CatalogKind = "food" | "retail";

export type CatalogFormProfile = {
  kind: CatalogKind;
  itemNoun: string;
  itemNounPlural: string;
  addTitle: string;
  editTitle: string;
  addButtonLabel: string;
  namePlaceholder: string;
  nameLabel: string;
  activeLabel: string;
  departmentLabel: string;
  hideDepartment: boolean;
  showReference: boolean;
  referenceLabel: string;
  referencePlaceholder: string;
  showPackaging: boolean;
  defaultUnit: ProductUnit;
  units: ProductUnit[];
  suggestedCategories: string[];
  keepRestaurantCategories: boolean;
};

const PIECE_PACK: ProductUnit[] = ["PIECE", "PACK", "CARTON", "BUNDLE"];
const SHOP_UNITS: ProductUnit[] = [
  "PIECE",
  "PACK",
  "KG",
  "LITER",
  "SACHET",
  "CARTON",
  "BUNDLE",
];

const FOOD_CATALOG: CatalogFormProfile = {
  kind: "food",
  itemNoun: "produit",
  itemNounPlural: "produits",
  addTitle: "Ajouter un produit",
  editTitle: "Modifier le produit",
  addButtonLabel: "Ajouter un produit",
  namePlaceholder: "Ex : Flag 65cl",
  nameLabel: "Nom",
  activeLabel: "Produit actif",
  departmentLabel: "Département",
  hideDepartment: false,
  showReference: false,
  referenceLabel: "Description",
  referencePlaceholder: "Notes (optionnel)",
  showPackaging: true,
  defaultUnit: "BOTTLE",
  units: ["BOTTLE", "CAN", "JERRYCAN", "SACHET"],
  suggestedCategories: [],
  keepRestaurantCategories: true,
};

const RETAIL_BASE: CatalogFormProfile = {
  kind: "retail",
  itemNoun: "article",
  itemNounPlural: "articles",
  addTitle: "Ajouter un article",
  editTitle: "Modifier l’article",
  addButtonLabel: "Ajouter un article",
  namePlaceholder: "Ex : nom de l’article",
  nameLabel: "Nom de l’article",
  activeLabel: "Article actif",
  departmentLabel: "Magasin",
  hideDepartment: true,
  showReference: true,
  referenceLabel: "Référence",
  referencePlaceholder: "Code / référence (optionnel)",
  showPackaging: false,
  defaultUnit: "PIECE",
  units: SHOP_UNITS,
  suggestedCategories: ["Général", "Autre"],
  keepRestaurantCategories: false,
};

const RETAIL_OVERRIDES: Partial<
  Record<Exclude<BusinessActivityId, "restaurant">, Partial<CatalogFormProfile>>
> = {
  supermarket: {
    namePlaceholder: "Ex : Riz 25 kg",
    departmentLabel: "Rayon",
    showPackaging: true,
    defaultUnit: "PIECE",
    units: SHOP_UNITS,
    suggestedCategories: [
      "Épicerie",
      "Boissons & eaux",
      "Produits frais",
      "Hygiène",
      "Entretien",
      "Autre",
    ],
  },
  clothing: {
    itemNoun: "article",
    namePlaceholder: "Ex : T-shirt col rond",
    referenceLabel: "Taille / couleur",
    referencePlaceholder: "Ex : M · noir (optionnel)",
    units: PIECE_PACK,
    suggestedCategories: [
      "Homme",
      "Femme",
      "Enfant",
      "Chaussures",
      "Accessoires",
      "Autre",
    ],
  },
  phones: {
    namePlaceholder: "Ex : Coque iPhone 13",
    referenceLabel: "Modèle / IMEI",
    referencePlaceholder: "Référence ou IMEI (optionnel)",
    units: PIECE_PACK,
    suggestedCategories: [
      "Téléphones",
      "Accessoires",
      "Écouteurs",
      "Chargeurs",
      "Réparation",
      "Autre",
    ],
  },
  pharmacy: {
    itemNoun: "produit",
    itemNounPlural: "produits",
    addTitle: "Ajouter un produit",
    editTitle: "Modifier le produit",
    addButtonLabel: "Ajouter un produit",
    namePlaceholder: "Ex : Paracétamol 500 mg",
    nameLabel: "Nom du produit",
    activeLabel: "Produit actif",
    departmentLabel: "Officine",
    referenceLabel: "DCI / dosage",
    referencePlaceholder: "Ex : paracétamol 500 mg (optionnel)",
    units: ["PIECE", "PACK", "SACHET", "BOTTLE", "CARTON"],
    suggestedCategories: [
      "Médicaments",
      "Parapharmacie",
      "Hygiène",
      "Bébé",
      "Autre",
    ],
  },
  cosmetics: {
    namePlaceholder: "Ex : Crème hydratante 50 ml",
    referencePlaceholder: "Marque / contenance (optionnel)",
    units: ["PIECE", "PACK", "SACHET", "CARTON"],
    suggestedCategories: [
      "Soins",
      "Maquillage",
      "Parfums",
      "Cheveux",
      "Autre",
    ],
  },
  "moto-parts": {
    itemNoun: "pièce",
    itemNounPlural: "pièces",
    addTitle: "Ajouter une pièce",
    editTitle: "Modifier la pièce",
    addButtonLabel: "Ajouter une pièce",
    namePlaceholder: "Ex : Plaquettes de frein",
    nameLabel: "Nom de la pièce",
    referenceLabel: "Référence pièce",
    referencePlaceholder: "Ex : OEM / N° pièce (optionnel)",
    units: ["PIECE", "PACK", "CARTON", "BUNDLE"],
    suggestedCategories: [
      "Moteur",
      "Freinage",
      "Électricité",
      "Transmission",
      "Consommables",
      "Autre",
    ],
  },
  "auto-parts": {
    itemNoun: "pièce",
    itemNounPlural: "pièces",
    addTitle: "Ajouter une pièce",
    editTitle: "Modifier la pièce",
    addButtonLabel: "Ajouter une pièce",
    namePlaceholder: "Ex : Filtre à huile",
    nameLabel: "Nom de la pièce",
    referenceLabel: "Référence pièce",
    referencePlaceholder: "Ex : OEM / N° pièce (optionnel)",
    units: ["PIECE", "PACK", "CARTON", "BUNDLE"],
    suggestedCategories: [
      "Moteur",
      "Freinage",
      "Électricité",
      "Carrosserie",
      "Consommables",
      "Autre",
    ],
  },
  vehicles: {
    itemNoun: "engin",
    itemNounPlural: "engins",
    addTitle: "Ajouter un engin",
    editTitle: "Modifier l’engin",
    addButtonLabel: "Ajouter un engin",
    namePlaceholder: "Ex : Moto 125 cm³",
    nameLabel: "Désignation",
    referenceLabel: "Marque / immatriculation",
    referencePlaceholder: "Ex : Yamaha · 12 AB 3456 (optionnel)",
    units: ["PIECE"],
    suggestedCategories: ["Motos", "Voitures", "Tricycles", "Pièces", "Autre"],
  },
  hardware: {
    namePlaceholder: "Ex : Marteau 500 g",
    units: SHOP_UNITS,
    suggestedCategories: [
      "Outillage",
      "Quincaillerie",
      "Électricité",
      "Plomberie",
      "Peinture",
      "Autre",
    ],
  },
  construction: {
    itemNoun: "matériau",
    itemNounPlural: "matériaux",
    addTitle: "Ajouter un matériau",
    editTitle: "Modifier le matériau",
    addButtonLabel: "Ajouter un matériau",
    namePlaceholder: "Ex : Ciment 50 kg",
    nameLabel: "Désignation",
    defaultUnit: "PIECE",
    units: ["PIECE", "KG", "PACK", "CARTON", "BUNDLE", "SACHET"],
    suggestedCategories: ["Ciment", "Fer", "Bois", "Agrégats", "Outillage", "Autre"],
  },
  wholesale: {
    namePlaceholder: "Ex : Carton savon 24 pcs",
    departmentLabel: "Entrepôt",
    showPackaging: true,
    units: ["PIECE", "PACK", "CARTON", "CASE", "KG", "BUNDLE"],
    suggestedCategories: ["Alimentaire", "Hygiène", "Boissons & eaux", "Divers", "Autre"],
  },
  other: {
    namePlaceholder: "Ex : nom de l’article",
    units: SHOP_UNITS,
    suggestedCategories: ["Général", "Autre"],
  },
};

function getRetailCatalogOverride(
  id: BusinessActivityId,
): Partial<CatalogFormProfile> | undefined {
  if (id === "restaurant") return undefined;
  return RETAIL_OVERRIDES[id];
}

export function getCatalogFormProfile(
  activityCode: string | null | undefined,
): CatalogFormProfile {
  const profile = getActivityProfile(activityCode);
  if (profile.kind !== "retail") {
    return FOOD_CATALOG;
  }

  return {
    ...RETAIL_BASE,
    departmentLabel: profile.catalogDepartmentLabel,
    ...getRetailCatalogOverride(profile.id),
  };
}

const RESTAURANT_CATEGORY_NAMES = new Set(
  [
    "Boissons",
    "Nourriture",
    "Plats",
    "Accompagnements",
    "Desserts",
    ...CAISSE_CATEGORIES.map((item) => item.name),
  ].map((name) => name.toLowerCase()),
);

export function isRestaurantSeedCategory(name: string): boolean {
  return RESTAURANT_CATEGORY_NAMES.has(name.trim().toLowerCase());
}

export function shouldShowCatalogCategory(
  categoryName: string,
  catalog: CatalogFormProfile,
): boolean {
  if (catalog.keepRestaurantCategories) return true;
  if (!isRestaurantSeedCategory(categoryName)) return true;
  return catalog.suggestedCategories.some(
    (item) => item.toLowerCase() === categoryName.trim().toLowerCase(),
  );
}

export { isRetailActivity };
