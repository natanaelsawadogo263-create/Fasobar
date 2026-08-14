export const HARDWARE_STOCK_UNIT_SUGGESTIONS = [
  "pièce",
  "unité",
  "mètre",
  "cm",
  "kg",
  "gramme",
  "litre",
  "sac",
  "pot",
  "barre",
  "feuille",
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
  { id: "variants", label: "Variantes" },
  { id: "stock", label: "Stock" },
  { id: "packs", label: "Colis" },
  { id: "trade", label: "Prix" },
  { id: "summary", label: "Résumé" },
] as const;

export type HardwareWizardStepId = (typeof HARDWARE_WIZARD_STEPS)[number]["id"];
