import { describe, expect, it } from "vitest";

import {
  buildBarcodeIndex,
  buildStockBarcodeIndex,
  decideScanAction,
  looksLikeBarcode,
  normalizeBarcode,
  resolveBarcode,
  resolveStockBarcode,
} from "@/lib/catalog/barcode";
import { saleLineKey } from "@/lib/catalog/sale-stock";
import type { CashierProduct } from "@/lib/orders/types";
import type { ProductPackaging } from "@/lib/products/types";
import type { StockListItem } from "@/lib/stock/types";

function product(overrides: Partial<CashierProduct> = {}): CashierProduct {
  return {
    id: "p1",
    name: "Coca-Cola 50 cl",
    sellingPrice: 500,
    unit: "BOTTLE",
    imageUrl: null,
    departmentCode: "BAR",
    departmentName: "Boissons",
    categoryId: "c1",
    categoryName: "Boissons",
    barcode: null,
    saleUnits: [],
    ...overrides,
  };
}

describe("normalizeBarcode", () => {
  it("retire les espaces superflus", () => {
    expect(normalizeBarcode("  5449000000996  ")).toBe("5449000000996");
  });
});

describe("looksLikeBarcode", () => {
  it("accepte un code numérique assez long", () => {
    expect(looksLikeBarcode("5449000000996")).toBe(true);
  });

  it("accepte un code interne FasoBar alphanumérique", () => {
    expect(looksLikeBarcode("FB2608219473")).toBe(true);
  });

  it("refuse un texte court (recherche par nom en cours de frappe)", () => {
    expect(looksLikeBarcode("coca")).toBe(false);
  });

  it("refuse un texte avec des espaces (nom produit, pas un scan)", () => {
    expect(looksLikeBarcode("coca cola 50cl")).toBe(false);
  });
});

describe("buildBarcodeIndex / resolveBarcode", () => {
  it("retrouve un produit par son code de base", () => {
    const coca = product({ id: "coca", barcode: "5449000000996" });
    const index = buildBarcodeIndex([coca]);
    const match = resolveBarcode(index, "5449000000996");
    expect(match?.product.id).toBe("coca");
    expect(match?.unit).toBeUndefined();
  });

  it("ignore la casse et les espaces au scan", () => {
    const coca = product({ id: "coca", barcode: "ABC123" });
    const index = buildBarcodeIndex([coca]);
    expect(resolveBarcode(index, "  abc123  ")?.product.id).toBe("coca");
  });

  it("retrouve un conditionnement (pack) par son propre code, distinct du code produit", () => {
    const coca = product({
      id: "coca",
      barcode: "CODE1",
      saleUnits: [
        { id: "unit-base", name: "Bouteille", price: 500, factor: 1 },
        { id: "unit-pack", name: "Carton de 6", price: 2800, factor: 6, barcode: "CODE2" },
      ],
    });
    const index = buildBarcodeIndex([coca]);

    const base = resolveBarcode(index, "CODE1");
    expect(base?.product.id).toBe("coca");
    expect(base?.unit).toBeUndefined(); // code produit (unité de base), pas un conditionnement

    const pack = resolveBarcode(index, "CODE2");
    expect(pack?.product.id).toBe("coca");
    expect(pack?.unit?.id).toBe("unit-pack");
    expect(pack?.unit?.factor).toBe(6);
  });

  it("renvoie null pour un code scanné sans correspondance", () => {
    const index = buildBarcodeIndex([product({ barcode: "111" })]);
    expect(resolveBarcode(index, "999")).toBeNull();
  });

  it("ignore les produits sans code-barres (facultatif)", () => {
    const withoutCode = product({ id: "pain", barcode: null });
    const index = buildBarcodeIndex([withoutCode]);
    expect(index.size).toBe(0);
  });
});

function stockItem(overrides: Partial<StockListItem> = {}): StockListItem {
  return {
    id: "s1",
    name: "Coca-Cola 50 cl",
    unit: "BOTTLE",
    currentQuantity: 48,
    minimumQuantity: 6,
    active: true,
    departmentCode: "BAR",
    departmentName: "Boissons",
    departmentId: "d1",
    productId: "coca",
    categoryId: "c1",
    categoryName: "Boissons",
    status: "ok",
    estimatedUnitCost: null,
    barcode: null,
    ...overrides,
  };
}

function packaging(overrides: Partial<ProductPackaging> = {}): ProductPackaging {
  return {
    id: "pack1",
    productId: "coca",
    name: "Carton de 6",
    packagingUnit: "CARTON",
    baseUnit: "Bouteille",
    conversionFactor: 6,
    active: true,
    barcode: null,
    ...overrides,
  };
}

describe("buildStockBarcodeIndex / resolveStockBarcode (approvisionnement)", () => {
  it("retrouve un article de stock par son code de base", () => {
    const item = stockItem({ barcode: "CODE1" });
    const index = buildStockBarcodeIndex([item], {});
    const match = resolveStockBarcode(index, "CODE1");
    expect(match?.stockItem.id).toBe("s1");
    expect(match?.unit).toBeUndefined();
  });

  it("retrouve le conditionnement d'achat (pack) par son code propre", () => {
    const item = stockItem({ productId: "coca" });
    const pack = packaging({ productId: "coca", barcode: "CODE2" });
    const index = buildStockBarcodeIndex([item], { coca: [pack] });
    const match = resolveStockBarcode(index, "CODE2");
    expect(match?.stockItem.id).toBe("s1");
    expect(match?.unit?.id).toBe("pack1");
  });

  it("code inconnu → aucune correspondance", () => {
    const index = buildStockBarcodeIndex([stockItem({ barcode: "AAA" })], {});
    expect(resolveStockBarcode(index, "BBB")).toBeNull();
  });
});

describe("decideScanAction — flux caisse (réutilise decideSaleFlow, pas un nouveau sélecteur)", () => {
  it("code produit + un seul mode de vente → ajout direct", () => {
    const eau = product({
      id: "eau",
      barcode: "CODE-EAU",
      sellingPrice: 300,
      saleUnits: [{ id: "unit-eau", name: "Sachet", price: 300, factor: 1 }],
    });
    const index = buildBarcodeIndex([eau]);

    const decision = decideScanAction(index, "CODE-EAU");

    expect(decision.type).toBe("add");
    if (decision.type === "add") {
      expect(decision.product.id).toBe("eau");
      expect(decision.choice?.id).toBe("unit-eau");
    }
  });

  it("code produit + plusieurs modes (Bouteille / Pack ×6) → sélecteur existant, pas d'ajout direct", () => {
    const coca = product({
      id: "coca",
      barcode: "CODE1",
      sellingPrice: 500,
      saleUnits: [
        { id: "unit-base", name: "Bouteille", price: 500, factor: 1 },
        { id: "unit-pack", name: "Pack", price: 2700, factor: 6 },
      ],
    });
    const index = buildBarcodeIndex([coca]);

    const decision = decideScanAction(index, "CODE1");

    expect(decision.type).toBe("picker");
    if (decision.type === "picker") {
      expect(decision.product.id).toBe("coca");
    }
  });

  it("code spécifique d'un conditionnement (pack) → ajout direct de CE pack, jamais de sélecteur", () => {
    const coca = product({
      id: "coca",
      barcode: "CODE1",
      sellingPrice: 500,
      saleUnits: [
        { id: "unit-base", name: "Bouteille", price: 500, factor: 1 },
        { id: "unit-pack", name: "Pack de 6", price: 2700, factor: 6, barcode: "CODE2" },
      ],
    });
    const index = buildBarcodeIndex([coca]);

    const decision = decideScanAction(index, "CODE2");

    expect(decision.type).toBe("add");
    if (decision.type === "add") {
      expect(decision.product.id).toBe("coca");
      expect(decision.choice?.id).toBe("unit-pack");
      expect(decision.choice?.factor).toBe(6);
    }
  });

  it("catalogue négoce (alwaysPicker) : toujours le sélecteur même à mode unique", () => {
    const article = product({
      id: "art",
      barcode: "CODE-ART",
      sellingPrice: 1000,
      saleUnits: [{ id: "unit-art", name: "Pièce", price: 1000, factor: 1 }],
    });
    const index = buildBarcodeIndex([article]);

    const decision = decideScanAction(index, "CODE-ART", { alwaysPicker: true });

    expect(decision.type).toBe("picker");
  });

  it("scan répété du même code → cible toujours la même ligne (même clé produit+unité)", () => {
    const coca = product({
      id: "coca",
      barcode: "CODE1",
      sellingPrice: 500,
      saleUnits: [{ id: "unit-base", name: "Bouteille", price: 500, factor: 1 }],
    });
    const index = buildBarcodeIndex([coca]);

    const first = decideScanAction(index, "CODE1");
    const second = decideScanAction(index, "CODE1");
    const third = decideScanAction(index, "code1"); // douchette : casse ignorée

    expect(first.type).toBe("add");
    expect(second.type).toBe("add");
    expect(third.type).toBe("add");
    if (first.type === "add" && second.type === "add" && third.type === "add") {
      const key = saleLineKey(first.product.id, first.choice?.id);
      expect(saleLineKey(second.product.id, second.choice?.id)).toBe(key);
      expect(saleLineKey(third.product.id, third.choice?.id)).toBe(key);
    }
  });

  it("code produit ET code pack du même produit, scannés l'un après l'autre → deux lignes distinctes possibles", () => {
    // Même produit vendu en unité (2 bouteilles) et en pack (1 pack ×6) sur le même
    // ticket : les deux doivent pouvoir coexister comme deux lignes séparées.
    const coca = product({
      id: "coca",
      barcode: "CODE1",
      sellingPrice: 500,
      saleUnits: [
        { id: "unit-base", name: "Bouteille", price: 500, factor: 1 },
        { id: "unit-pack", name: "Pack de 6", price: 2700, factor: 6, barcode: "CODE2" },
      ],
    });
    const index = buildBarcodeIndex([coca]);

    const baseScan = decideScanAction(index, "CODE1"); // un seul mode restant ? non : 2 modes → picker
    // Ici le produit a 2 modes, donc le scan du code produit ouvre le sélecteur ;
    // on simule directement le choix « Bouteille » comme le ferait le caissier.
    expect(baseScan.type).toBe("picker");

    const packScan = decideScanAction(index, "CODE2");
    expect(packScan.type).toBe("add");
    if (packScan.type === "add") {
      const bottleKey = saleLineKey("coca", "unit-base");
      const packKey = saleLineKey(packScan.product.id, packScan.choice?.id);
      expect(packKey).not.toBe(bottleKey); // deux lignes distinctes, pas de fusion
    }
  });
});
