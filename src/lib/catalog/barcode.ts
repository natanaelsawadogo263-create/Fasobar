import { decideSaleFlow, type CashierSaleChoice } from "@/lib/catalog/sale-choices";
import type { CashierProduct } from "@/lib/orders/types";
import type { ProductPackaging } from "@/lib/products/types";
import type { StockListItem } from "@/lib/stock/types";

export type BarcodeSaleUnit = NonNullable<CashierProduct["saleUnits"]>[number];

export type BarcodeMatch = {
  product: CashierProduct;
  /** Absent = code de l'unité de base (products.barcode). */
  unit?: BarcodeSaleUnit;
};

/**
 * Une douchette USB émule un clavier « US » (QWERTY) : chaque chiffre 0-9
 * envoie le même code de touche physique qu'un clavier QWERTY, quelle que
 * soit la disposition réellement configurée sur le poste. Sur un clavier
 * français (AZERTY, standard en Afrique francophone), ces mêmes touches sans
 * Maj produisent des caractères accentués/ponctuation au lieu des chiffres —
 * un code réel « 8886409508017 » ressort scanné comme « ___-'àç(à_à&è ».
 * Cette table est la correspondance AZERTY (rangée des chiffres, sans Maj) →
 * chiffre voulu, pour corriger ce cas précis.
 */
const AZERTY_UNSHIFTED_DIGIT_MAP: Record<string, string> = {
  "&": "1",
  "é": "2",
  '"': "3",
  "'": "4",
  "(": "5",
  "-": "6",
  "è": "7",
  "_": "8",
  "ç": "9",
  "à": "0",
};

/**
 * Corrige un code scanné produit par une douchette sur un poste en clavier
 * AZERTY. Ne transforme QUE si chaque caractère est soit déjà un chiffre,
 * soit l'un des 10 caractères AZERTY ci-dessus — un vrai code alphanumérique
 * (Code128 avec de véritables lettres, par exemple) contient d'autres
 * caractères et ressort donc inchangé, jamais corrompu par erreur.
 */
export function correctAzertyScannedBarcode(raw: string): string {
  if (!raw || /^[0-9]+$/.test(raw)) return raw;

  let translated = "";
  for (const char of raw) {
    if (char >= "0" && char <= "9") {
      translated += char;
      continue;
    }
    const digit = AZERTY_UNSHIFTED_DIGIT_MAP[char];
    if (!digit) return raw;
    translated += digit;
  }
  return translated;
}

/** Normalise un code scanné : espaces superflus retirés, casse ignorée pour la clé d'index. */
export function normalizeBarcode(raw: string): string {
  return correctAzertyScannedBarcode(raw.trim());
}

function indexKey(value: string): string {
  return normalizeBarcode(value).toLowerCase();
}

/**
 * Index code-barres → produit (+ conditionnement éventuel), construit une fois par
 * catalogue chargé. O(1) à la lecture : le scan doit rester instantané en caisse.
 */
export function buildBarcodeIndex(
  products: CashierProduct[],
): Map<string, BarcodeMatch> {
  const index = new Map<string, BarcodeMatch>();

  for (const product of products) {
    const productCode = product.barcode?.trim();
    if (productCode) {
      index.set(indexKey(productCode), { product });
    }
    for (const unit of product.saleUnits ?? []) {
      const unitCode = unit.barcode?.trim();
      if (unitCode) {
        index.set(indexKey(unitCode), { product, unit });
      }
    }
  }

  return index;
}

/** Retrouve un produit (ou son conditionnement) à partir d'un code scanné. */
export function resolveBarcode(
  index: Map<string, BarcodeMatch>,
  scanned: string,
): BarcodeMatch | null {
  const normalized = normalizeBarcode(scanned);
  if (!normalized) return null;
  return index.get(indexKey(normalized)) ?? null;
}

/**
 * Heuristique « ça ressemble à un code scanné » plutôt qu'à une recherche par nom :
 * assez long, uniquement chiffres/lettres/tirets, sans espace. Sert uniquement à décider
 * si un code non trouvé mérite le message « Produit introuvable » (vs recherche texte).
 */
export function looksLikeBarcode(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 6) return false;
  return /^[a-zA-Z0-9-]+$/.test(trimmed);
}

export type ScanAction =
  | { type: "not-found" }
  | { type: "unknown"; code: string }
  | { type: "add"; product: CashierProduct; choice?: CashierSaleChoice | BarcodeSaleUnit }
  | { type: "picker"; product: CashierProduct };

/**
 * Résout un scan caisse en décision d'action :
 * - code de conditionnement précis (product_unit_levels.barcode) → ajout direct de
 *   CE conditionnement, le code désigne déjà l'unité exacte, pas de sélecteur ;
 * - code produit principal (products.barcode) → réutilise la décision existante
 *   « un seul mode = ajout direct, plusieurs modes = sélecteur » (decideSaleFlow),
 *   la même que pour un ajout au clic depuis la grille produits.
 */
export function decideScanAction(
  index: Map<string, BarcodeMatch>,
  rawCode: string,
  options: { shopLots?: boolean; alwaysPicker?: boolean } = {},
): ScanAction {
  const match = resolveBarcode(index, rawCode);
  if (!match) {
    // Corrigé AVANT le test « ça ressemble à un code » : un scan brouillé par
    // un clavier AZERTY (accents/ponctuation) ne matcherait sinon jamais ce
    // test et retomberait en recherche texte muette, sans le bandeau « code
    // inconnu » qui permet de créer le produit.
    const corrected = normalizeBarcode(rawCode);
    return looksLikeBarcode(corrected)
      ? { type: "unknown", code: corrected }
      : { type: "not-found" };
  }

  if (match.unit) {
    return { type: "add", product: match.product, choice: match.unit };
  }

  const decision = decideSaleFlow(match.product, options);
  if (decision.action === "picker") {
    return { type: "picker", product: match.product };
  }
  return { type: "add", product: match.product, choice: decision.choice };
}

export type StockBarcodeMatch = {
  stockItem: StockListItem;
  /** Absent = code de l'unité de base ; sinon conditionnement d'achat (pack). */
  unit?: ProductPackaging;
};

/**
 * Même principe que buildBarcodeIndex, côté stock/approvisionnement : résout un scan
 * vers l'article de stock (+ éventuellement son conditionnement d'achat).
 */
export function buildStockBarcodeIndex(
  stockItems: StockListItem[],
  packagingsByProduct: Record<string, ProductPackaging[]>,
): Map<string, StockBarcodeMatch> {
  const index = new Map<string, StockBarcodeMatch>();

  for (const stockItem of stockItems) {
    const code = stockItem.barcode?.trim();
    if (code) {
      index.set(indexKey(code), { stockItem });
    }
    if (!stockItem.productId) continue;
    for (const unit of packagingsByProduct[stockItem.productId] ?? []) {
      const unitCode = unit.barcode?.trim();
      if (unitCode) {
        index.set(indexKey(unitCode), { stockItem, unit });
      }
    }
  }

  return index;
}

export function resolveStockBarcode(
  index: Map<string, StockBarcodeMatch>,
  scanned: string,
): StockBarcodeMatch | null {
  const normalized = normalizeBarcode(scanned);
  if (!normalized) return null;
  return index.get(indexKey(normalized)) ?? null;
}
