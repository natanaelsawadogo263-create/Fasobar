export const SALE_TYPES = [
  { id: "UNIT", label: "À l’unité", stockUnit: "pièce", fractionable: false },
  { id: "WEIGHT", label: "Au poids", stockUnit: "kg", fractionable: true },
  { id: "LENGTH", label: "À la longueur", stockUnit: "mètre", fractionable: true },
  { id: "VOLUME", label: "Au volume", stockUnit: "litre", fractionable: true },
  { id: "PACKS", label: "Avec plusieurs conditionnements", stockUnit: "pièce", fractionable: false },
] as const;

export type SaleTypeId = (typeof SALE_TYPES)[number]["id"];

export const STOCK_UNIT_SUGGESTIONS = [
  "pièce",
  "unité",
  "kg",
  "gramme",
  "mètre",
  "cm",
  "m²",
  "litre",
  "sac",
  "boîte",
  "rouleau",
  "carton",
  "paquet",
  "bidon",
  "pot",
  "barre",
  "feuille",
] as const;

export function saleTypeOf(value: string | null | undefined): SaleTypeId {
  return SALE_TYPES.some((item) => item.id === value)
    ? (value as SaleTypeId)
    : "UNIT";
}

export function saleTypeDefaults(id: SaleTypeId) {
  return SALE_TYPES.find((item) => item.id === id) ?? SALE_TYPES[0];
}
