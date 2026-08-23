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

/** Normalise un code scanné : espaces superflus retirés, casse ignorée pour la clé d'index. */
export function normalizeBarcode(raw: string): string {
  return raw.trim();
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
    return looksLikeBarcode(rawCode)
      ? { type: "unknown", code: normalizeBarcode(rawCode) }
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
