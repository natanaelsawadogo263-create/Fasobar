import type { ProductUnit } from "@/lib/products/schemas";

function normalizeUnitLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const EXACT_UNIT_MAP: Record<string, ProductUnit> = {
  piece: "PIECE",
  pieces: "PIECE",
  unite: "PIECE",
  unites: "PIECE",
  sac: "SAC",
  sacs: "SAC",
  sachet: "SACHET",
  sachets: "SACHET",
  kg: "KG",
  kilo: "KG",
  kilos: "KG",
  kilogramme: "KG",
  kilogrammes: "KG",
  gramme: "KG",
  grammes: "KG",
  metre: "METER",
  metres: "METER",
  m: "METER",
  cm: "METER",
  litre: "LITER",
  litres: "LITER",
  l: "LITER",
  barre: "BARRE",
  barres: "BARRE",
  feuille: "SHEET",
  feuilles: "SHEET",
  rouleau: "ROLL",
  rouleaux: "ROLL",
  tonne: "TONNE",
  tonnes: "TONNE",
  carton: "CARTON",
  cartons: "CARTON",
  pot: "JERRYCAN",
  pots: "JERRYCAN",
  bidon: "JERRYCAN",
  bidons: "JERRYCAN",
  boite: "PACK",
  boites: "PACK",
  paquet: "BUNDLE",
  paquets: "BUNDLE",
};

/** Enum SQL interne. L’affichage doit utiliser `stock_unit_label` (sac, boîte…). */
export function mapLabelToProductUnit(label: string): ProductUnit {
  const n = normalizeUnitLabel(label);
  if (!n) return "PIECE";
  if (EXACT_UNIT_MAP[n]) return EXACT_UNIT_MAP[n];
  if (n.includes("sachet")) return "SACHET";
  if (n === "sac" || n.startsWith("sac ") || n.endsWith(" sac") || n.includes("sacs"))
    return "SAC";
  if (n.includes("metre")) return "METER";
  if (n.includes("kilo") || n.includes("gramme")) return "KG";
  if (n.includes("litre")) return "LITER";
  if (n.includes("barre")) return "BARRE";
  if (n.includes("feuille")) return "SHEET";
  if (n.includes("rouleau")) return "ROLL";
  if (n.includes("tonne")) return "TONNE";
  if (n.includes("carton")) return "CARTON";
  if (n.includes("bidon") || n.includes("pot")) return "JERRYCAN";
  return "PIECE";
}
