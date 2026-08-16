export const HARDWARE_STOCK_UNIT_SUGGESTIONS = [
  "pièce",
  "rouleau",
  "carton",
  "boîte",
  "sachet",
  "sac",
  "pot",
  "bidon",
  "kg",
  "litre",
  "mètre",
  "paquet",
  "barre",
  "pack",
  "casier",
  "unité",
] as const;

export const HARDWARE_WHOLESALE_PACKS = [
  "carton",
  "boîte",
  "sachet",
  "pack",
  "casier",
  "sac",
  "paquet",
  "rouleau",
] as const;

export const HARDWARE_ATTRIBUTE_SUGGESTIONS = [
  "Diamètre",
  "Taille",
  "Volume",
  "Couleur",
  "Puissance",
  "Longueur",
  "Épaisseur",
  "Section",
  "Poids",
  "Format",
] as const;

export const HARDWARE_WIZARD_STEPS = [
  { id: "info", label: "Infos" },
  { id: "stock", label: "Stock" },
  { id: "packs", label: "Colis" },
  { id: "trade", label: "Prix" },
  { id: "summary", label: "Résumé" },
] as const;

export type HardwareWizardStepId = (typeof HARDWARE_WIZARD_STEPS)[number]["id"];
