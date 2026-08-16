export const PRODUCT_CHARACTERISTIC_FIELDS = [
  { id: "brand", label: "Marque" },
  { id: "color", label: "Couleur" },
  { id: "size", label: "Taille" },
  { id: "dimension", label: "Dimension" },
  { id: "diameter", label: "Diamètre" },
  { id: "length", label: "Longueur" },
  { id: "power", label: "Puissance" },
  { id: "capacity", label: "Capacité" },
  { id: "material", label: "Matière" },
  { id: "model", label: "Modèle" },
  { id: "manufacturerRef", label: "Référence fabricant" },
] as const;

export type CharacteristicId = (typeof PRODUCT_CHARACTERISTIC_FIELDS)[number]["id"];

export type ProductCharacteristics = Partial<Record<CharacteristicId, string>> & {
  extras?: Array<{ name: string; value: string }>;
};

export function emptyCharacteristics(): ProductCharacteristics {
  return {};
}
