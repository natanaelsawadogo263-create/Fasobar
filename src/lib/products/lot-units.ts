import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { productUnitDisplayLabel } from "@/lib/products/persist-unit";
import type { ProductUnit } from "@/lib/products/schemas";

type LotClient = {
  from: (table: string) => any;
};

type LotRow = {
  id: string;
  name: string;
  is_base: boolean;
};

export type ProductLotInput = {
  productId: string;
  baseUnit: ProductUnit;
  lotName: string;
  unitsPerLot: number;
  sellingPrice: number;
  lotSellingPrice: number;
};

function isMissingUnitLevelsError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("product_unit_levels")
  );
}

function normalizeLotName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Crée ou met à jour Unité + Lot (ex. bidon + carton de 5) pour la caisse et l’appro.
 * Sans effet si le coefficient < 2. Ignore si la table n’existe pas.
 */
export async function ensureProductLotUnits(
  client: LotClient,
  workspace: Pick<WorkspaceContext, "organizationId" | "establishmentId" | "userId">,
  input: ProductLotInput,
): Promise<void> {
  if (!Number.isFinite(input.unitsPerLot) || input.unitsPerLot < 2) {
    return;
  }

  if (!Number.isFinite(input.lotSellingPrice) || input.lotSellingPrice <= 0) {
    throw new Error("Indiquez le prix de vente du lot.");
  }

  const baseName = productUnitDisplayLabel(input.baseUnit);
  const lotName = input.lotName.trim();
  if (!lotName) return;

  const listed = (await (
    client
      .from("product_unit_levels")
      .select("id, name, is_base, parent_id")
      .eq("product_id", input.productId)
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId) as unknown as Promise<{
      data: LotRow[] | null;
      error: { message?: string; code?: string } | null;
    }>
  ));

  if (listed.error) {
    if (isMissingUnitLevelsError(listed.error)) return;
    throw new Error(listed.error.message ?? "Impossible de lire les conditionnements.");
  }

  const rows = listed.data ?? [];
  let baseId = rows.find((row) => row.is_base)?.id ?? null;

  if (!baseId) {
    const inserted = await insertUnitLevel(client, workspace, {
      productId: input.productId,
      name: baseName,
      parentId: null,
      containsQty: 1,
      isBase: true,
      sellable: true,
      sellingPrice: Math.round(input.sellingPrice || 0),
      sortOrder: 0,
    });
    if (!inserted) return;
    baseId = inserted;
  } else {
    await (
      client
        .from("product_unit_levels")
        .update({
          name: baseName,
          selling_price: Math.round(input.sellingPrice || 0),
          sellable: true,
          updated_by: workspace.userId,
        })
        .eq("id", baseId)
        .eq("product_id", input.productId)
        .eq("organization_id", workspace.organizationId)
        .eq("establishment_id", workspace.establishmentId) as unknown as Promise<unknown>
    );
  }

  const existingLot = rows.find(
    (row) => !row.is_base && normalizeLotName(row.name) === normalizeLotName(lotName),
  );

  if (existingLot) {
    await (
      client
        .from("product_unit_levels")
        .update({
          name: lotName,
          parent_id: baseId,
          contains_qty: input.unitsPerLot,
          purchasable: true,
          sellable: true,
          selling_price: Math.round(input.lotSellingPrice),
          updated_by: workspace.userId,
        })
        .eq("id", existingLot.id)
        .eq("product_id", input.productId)
        .eq("organization_id", workspace.organizationId)
        .eq("establishment_id", workspace.establishmentId) as unknown as Promise<unknown>
    );
    return;
  }

  await insertUnitLevel(client, workspace, {
    productId: input.productId,
    name: lotName,
    parentId: baseId,
    containsQty: input.unitsPerLot,
    isBase: false,
    sellable: true,
    sellingPrice: Math.round(input.lotSellingPrice),
    sortOrder: 1,
  });
}

export async function syncBaseLotSellingPrice(
  client: LotClient,
  workspace: Pick<WorkspaceContext, "organizationId" | "establishmentId" | "userId">,
  productId: string,
  sellingPrice: number,
): Promise<void> {
  const result = (await (
    client
      .from("product_unit_levels")
      .update({
        selling_price: Math.round(sellingPrice || 0),
        updated_by: workspace.userId,
      })
      .eq("product_id", productId)
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId)
      .eq("is_base", true) as unknown as Promise<{
      error: { message?: string; code?: string } | null;
    }>
  ));

  if (result.error && !isMissingUnitLevelsError(result.error)) {
    console.warn("[syncBaseLotSellingPrice]", result.error.message);
  }
}

export async function deactivateLotUnitByName(
  client: LotClient,
  workspace: Pick<WorkspaceContext, "organizationId" | "establishmentId" | "userId">,
  productId: string,
  lotName: string,
): Promise<void> {
  const listed = (await (
    client
      .from("product_unit_levels")
      .select("id, name, is_base, parent_id")
      .eq("product_id", productId)
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId) as unknown as Promise<{
      data: LotRow[] | null;
      error: { message?: string; code?: string } | null;
    }>
  ));

  if (listed.error || !listed.data) return;

  const target = listed.data.find(
    (row) => !row.is_base && normalizeLotName(row.name) === normalizeLotName(lotName),
  );
  if (!target) return;

  await (
    client
      .from("product_unit_levels")
      .update({
        sellable: false,
        purchasable: false,
        updated_by: workspace.userId,
      })
      .eq("id", target.id)
      .eq("product_id", productId)
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId) as unknown as Promise<unknown>
  );
}

async function insertUnitLevel(
  client: LotClient,
  workspace: Pick<WorkspaceContext, "organizationId" | "establishmentId" | "userId">,
  row: {
    productId: string;
    name: string;
    parentId: string | null;
    containsQty: number;
    isBase: boolean;
    sellable: boolean;
    sellingPrice: number | null;
    sortOrder: number;
  },
): Promise<string | null> {
  const payload = {
    organization_id: workspace.organizationId,
    establishment_id: workspace.establishmentId,
    product_id: row.productId,
    name: row.name,
    parent_id: row.parentId,
    contains_qty: row.containsQty,
    is_base: row.isBase,
    purchasable: true,
    sellable: row.sellable,
    purchase_price: null,
    selling_price: row.sellingPrice,
    allow_decimal: false,
    sort_order: row.sortOrder,
    created_by: workspace.userId,
    updated_by: workspace.userId,
  };

  let result = await client.from("product_unit_levels").insert(payload).select("id").maybeSingle();

  if (result.error && (result.error.message ?? "").includes("allow_decimal")) {
    const { allow_decimal: _allow, ...withoutDecimal } = payload;
    void _allow;
    result = await client
      .from("product_unit_levels")
      .insert(withoutDecimal)
      .select("id")
      .maybeSingle();
  }

  if (result.error) {
    if (isMissingUnitLevelsError(result.error)) return null;
    throw new Error(result.error.message ?? "Impossible d’enregistrer le lot.");
  }

  return result.data?.id ?? null;
}

type UnitLevelPriceRow = {
  is_base: boolean;
  sellable: boolean;
  selling_price: number | null;
  contains_qty: number;
};

/** Aligne les unités caisse (product_unit_levels) avec les lots configurés. */
export async function repairShopSaleUnitsIfNeeded(
  client: LotClient,
  workspace: Pick<WorkspaceContext, "organizationId" | "establishmentId" | "userId" | "activityCode">,
  productId: string,
  meta: { unit: ProductUnit; sellingPrice: number },
  packagings: Array<{ name: string; packagingUnit: string; conversionFactor: number; active: boolean }>,
): Promise<void> {
  const { usesOptionalProductLots } = await import("@/lib/activity/catalog");
  const { BAR_PACKAGING_LABELS } = await import("@/lib/products/constants");
  const { listCommerceUnitsForProducts } = await import("@/lib/products/packaging-queries");

  if (!usesOptionalProductLots(workspace.activityCode)) return;

  const lots = packagings.filter(
    (item) => item.active && Number(item.conversionFactor) >= 2,
  );
  if (lots.length === 0) return;

  const saleUnits = await listCommerceUnitsForProducts(workspace, [productId], "sale");
  const ready = (saleUnits[productId] ?? []).some(
    (unit) => unit.conversionFactor > 1 && Boolean(unit.id) && (unit.sellingPrice ?? 0) > 0,
  );
  if (ready) return;

  const listed = (await (
    client
      .from("product_unit_levels")
      .select("is_base, sellable, selling_price, contains_qty")
      .eq("product_id", productId)
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId) as unknown as Promise<{
      data: UnitLevelPriceRow[] | null;
      error: { message?: string; code?: string } | null;
    }>
  ));

  if (listed.error && !isMissingUnitLevelsError(listed.error)) return;

  const lotPack = lots[0]!;
  const lotLabel =
    BAR_PACKAGING_LABELS[lotPack.packagingUnit as keyof typeof BAR_PACKAGING_LABELS] ??
    lotPack.name;
  const lotRow = (listed.data ?? []).find((row) => !row.is_base);
  const lotPrice = lotRow?.selling_price ?? null;
  if (!lotPrice || lotPrice <= 0) return;

  await ensureProductLotUnits(client, workspace, {
    productId,
    baseUnit: meta.unit,
    lotName: lotLabel,
    unitsPerLot: lotPack.conversionFactor,
    sellingPrice: meta.sellingPrice,
    lotSellingPrice: Number(lotPrice),
  });
}
