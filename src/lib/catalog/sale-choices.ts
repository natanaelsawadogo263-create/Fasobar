export type SaleUnitOption = {
  id: string;
  name: string;
  price: number;
  factor: number;
  allowDecimal?: boolean;
};

export type CashierSaleKind = "unit" | "pack" | "detail";

export type CashierSaleChoice = SaleUnitOption & {
  title: string;
  hint: string;
  kind: CashierSaleKind;
};

function roundCfa(value: number): number {
  return Math.max(1, Math.round(value));
}

function deriveMissingPrices(units: SaleUnitOption[], productPrice: number): SaleUnitOption[] {
  const packs = units.filter((unit) => unit.factor > 1);
  const bases = units.filter((unit) => unit.factor <= 1);

  return units.map((unit) => {
    if (unit.price > 0) return unit;
    if (unit.factor > 1) {
      const base = bases.find((item) => item.price > 0);
      if (base) return { ...unit, price: roundCfa(base.price * unit.factor) };
      if (productPrice > 0 && packs.length === 1) {
        return { ...unit, price: productPrice };
      }
      return unit;
    }
    const pack = packs.find((item) => item.price > 0);
    if (pack) return { ...unit, price: roundCfa(pack.price / pack.factor) };
    if (productPrice > 0) return { ...unit, price: productPrice };
    return unit;
  });
}

/** Choix caisse : Unité, Gros/Lot, Détail (montant). */
export function buildCashierSaleChoices(
  product: {
    sellingPrice: number;
    unit: string;
    fractionable?: boolean;
    saleUnits?: SaleUnitOption[] | null;
  },
  options?: { shopLots?: boolean },
): CashierSaleChoice[] {
  const packLabel = options?.shopLots ? "Lot" : "Gros";
  const raw = (product.saleUnits ?? []).filter((unit) => unit.name.trim());
  const priced = deriveMissingPrices(raw, product.sellingPrice);
  const choices: CashierSaleChoice[] = [];
  let unitChoice: CashierSaleChoice | null = null;

  for (const unit of priced) {
    if (unit.price <= 0) continue;
    if (unit.factor > 1) {
      choices.push({
        ...unit,
        allowDecimal: false,
        kind: "pack",
        title: `${packLabel} · ${unit.name} de ${unit.factor}`,
        hint: `${roundCfa(unit.price)} F le ${unit.name}`,
      });
      continue;
    }
    unitChoice = {
      ...unit,
      allowDecimal: false,
      kind: "unit",
      title: `Unité · ${unit.name}`,
      hint: `${roundCfa(unit.price)} F / ${unit.name}`,
    };
    choices.push(unitChoice);
  }

  if (choices.length === 0 && product.sellingPrice > 0) {
    const name = product.unit || "unité";
    unitChoice = {
      id: "",
      name,
      price: product.sellingPrice,
      factor: 1,
      allowDecimal: false,
      kind: "unit",
      title: `Unité · ${name}`,
      hint: `${roundCfa(product.sellingPrice)} F / ${name}`,
    };
    choices.push(unitChoice);
  }

  if (product.fractionable && unitChoice) {
    choices.push({
      ...unitChoice,
      id: unitChoice.id,
      kind: "detail",
      title: "Détail",
      hint: "Le client donne un montant : on calcule la quantité",
      allowDecimal: true,
    });
  }

  const seen = new Set<string>();
  return choices.filter((choice) => {
    const key = `${choice.kind}::${choice.id}::${choice.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function salePickerHint(
  choices: CashierSaleChoice[],
  options?: { shopLots?: boolean },
): string {
  const hasPack = choices.some((choice) => choice.kind === "pack");
  const hasDetail = choices.some((choice) => choice.kind === "detail");
  if (hasPack && hasDetail) {
    return options?.shopLots
      ? "Unité, lot, ou un montant (détail)."
      : "Unité, gros, ou un montant (détail).";
  }
  if (hasPack) return options?.shopLots ? "Unité ou lot." : "Unité ou gros.";
  if (hasDetail) return "Unité entière, ou détail selon le montant.";
  return "";
}
