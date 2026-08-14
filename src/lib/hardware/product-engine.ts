export type PackagingNode = {
  id: string;
  name: string;
  parentId: string | null;
  containsQty: number;
  purchasable?: boolean;
  sellable?: boolean;
  purchasePrice?: number;
  sellingPrice?: number;
};

export type ConversionOk = {
  ok: true;
  factor: number;
  chain: string[];
};

export type ConversionErr = {
  ok: false;
  error: string;
};

export function normalizeUnitLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function toBaseFactor(
  nodes: PackagingNode[],
  id: string,
): ConversionOk | ConversionErr {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const node = byId.get(id);
  if (!node) {
    return { ok: false, error: "Conditionnement introuvable." };
  }

  const seen = new Set<string>();
  const chain: string[] = [];
  let current: PackagingNode | undefined = node;
  let factor = 1;
  let guard = 0;

  while (current) {
    if (seen.has(current.id)) {
      return { ok: false, error: "Conversion circulaire détectée." };
    }
    if (current.containsQty <= 0) {
      return {
        ok: false,
        error: `« ${current.name} » : la quantité doit être strictement positive.`,
      };
    }
    seen.add(current.id);
    chain.push(current.name);
    if (!current.parentId) {
      return { ok: true, factor, chain };
    }
    if (current.parentId === current.id) {
      return { ok: false, error: "Une unité ne peut pas se contenir elle-même." };
    }
    factor *= current.containsQty;
    current = byId.get(current.parentId);
    if (!current) {
      return { ok: false, error: "Parent de conversion introuvable." };
    }
    guard += 1;
    if (guard > 20) {
      return { ok: false, error: "Conversion trop profonde ou circulaire." };
    }
  }

  return { ok: false, error: "Conversion impossible." };
}

export function validatePackagingGraph(
  nodes: PackagingNode[],
): { ok: true } | ConversionErr {
  const names = nodes.map((node) => normalizeUnitLabel(node.name).toLowerCase());
  const unique = new Set(names);
  if (unique.size !== names.length) {
    return { ok: false, error: "Deux conditionnements portent le même nom." };
  }

  const bases = nodes.filter((node) => !node.parentId);
  if (bases.length !== 1) {
    return {
      ok: false,
      error: "Il faut exactement une unité de stock de référence.",
    };
  }

  for (const node of nodes) {
    if (!normalizeUnitLabel(node.name)) {
      return { ok: false, error: "Chaque conditionnement doit avoir un nom." };
    }
    if (!Number.isFinite(node.containsQty) || node.containsQty <= 0) {
      return {
        ok: false,
        error: `« ${node.name} » : indiquez une quantité supérieure à 0.`,
      };
    }
    if (node.parentId === node.id) {
      return { ok: false, error: "Une unité ne peut pas se contenir elle-même." };
    }
    const converted = toBaseFactor(nodes, node.id);
    if (!converted.ok) return converted;
  }

  return { ok: true };
}

export function formatConversionLabel(
  nodes: PackagingNode[],
  id: string,
): string | null {
  const result = toBaseFactor(nodes, id);
  if (!result.ok) return null;
  const node = nodes.find((item) => item.id === id);
  const base = nodes.find((item) => !item.parentId);
  if (!node || !base) return null;
  if (!node.parentId) return `${node.name} (unité de stock)`;
  const qty = Number.isInteger(result.factor)
    ? String(result.factor)
    : String(Number(result.factor.toFixed(4)));
  return `1 ${node.name} = ${qty} ${base.name}${result.factor > 1 ? "s" : ""}`;
}

export function firstSellablePrice(nodes: PackagingNode[]): number {
  const priced = nodes.find(
    (node) => node.sellable && (node.sellingPrice ?? 0) > 0,
  );
  return priced?.sellingPrice ?? 0;
}

export function firstPurchasablePrice(nodes: PackagingNode[]): number {
  const priced = nodes.find(
    (node) => node.purchasable && (node.purchasePrice ?? 0) > 0,
  );
  return priced?.purchasePrice ?? 0;
}
