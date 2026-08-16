import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type { ProductPackaging } from "@/lib/products/types";
import { toBaseFactor, type PackagingNode } from "@/lib/hardware/product-engine";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PackagingRow = {
  id: string;
  product_id: string;
  name: string;
  packaging_unit: string;
  base_unit: string;
  conversion_factor: number;
  active: boolean;
};

function mapPackaging(row: PackagingRow): ProductPackaging {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    packagingUnit: row.packaging_unit,
    baseUnit: row.base_unit,
    conversionFactor: Number(row.conversion_factor),
    active: row.active,
  };
}

function isMissingTableError(error: { message?: string; code?: string }): boolean {
  const msg = error.message ?? "";
  const code = error.code ?? "";
  return (
    code === "42P01" ||
    msg.includes("relation") ||
    msg.includes("product_packagings") ||
    msg.includes("does not exist")
  );
}

async function getPackagingReadClient(_workspace?: WorkspaceContext) {
  if (isAdminClientConfigured()) {
    return createAdminClient();
  }
  return createClient();
}

export async function listProductPackagings(
  workspace: WorkspaceContext,
  productId: string,
): Promise<ProductPackaging[]> {
  const supabase = await getPackagingReadClient(workspace);

  const { data, error } = await supabase
    .from("product_packagings")
    .select("id, product_id, name, packaging_unit, base_unit, conversion_factor, active")
    .eq("product_id", productId)
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("name");

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    return [];
  }

  return (data ?? []).map((row) => mapPackaging(row as PackagingRow));
}

export async function listPackagingsForProducts(
  workspace: WorkspaceContext,
  productIds: string[],
): Promise<Record<string, ProductPackaging[]>> {
  if (productIds.length === 0) {
    return {};
  }

  const supabase = await getPackagingReadClient(workspace);

  const { data, error } = await supabase
    .from("product_packagings")
    .select("id, product_id, name, packaging_unit, base_unit, conversion_factor, active")
    .in("product_id", productIds)
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("name");

  if (error) {
    if (isMissingTableError(error)) {
      return {};
    }
    return {};
  }

  const result: Record<string, ProductPackaging[]> = {};

  for (const row of (data ?? []) as PackagingRow[]) {
    const packaging = mapPackaging(row);
    if (!result[packaging.productId]) {
      result[packaging.productId] = [];
    }
    result[packaging.productId]!.push(packaging);
  }

  return result;
}

type UnitLevelRow = {
  id: string;
  product_id: string;
  variant_id?: string | null;
  name: string;
  parent_id: string | null;
  contains_qty: number;
  is_base: boolean;
  purchasable: boolean;
  sellable: boolean;
  selling_price: number | null;
  purchase_price: number | null;
  allow_decimal: boolean;
};

function pickProductUnitTree(rows: UnitLevelRow[]): UnitLevelRow[] {
  const productLevel = rows.filter((row) => !row.variant_id);
  if (productLevel.length > 0) return productLevel;
  const firstVariantId = rows.find((row) => row.variant_id)?.variant_id;
  if (!firstVariantId) return rows;
  return rows.filter((row) => row.variant_id === firstVariantId);
}

function unitLevelsToPackagings(rows: UnitLevelRow[], mode: "purchase" | "sale"): ProductPackaging[] {
  if (rows.length === 0) return [];
  const nodes: PackagingNode[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    containsQty: Number(row.contains_qty) || 1,
    purchasable: row.purchasable,
    sellable: row.sellable,
    purchasePrice: row.purchase_price ?? 0,
    sellingPrice: row.selling_price ?? 0,
  }));
  const selected =
    mode === "purchase"
      ? rows.filter((row) => row.purchasable || row.is_base)
      : rows.filter((row) => row.sellable || row.is_base);
  const useRows = selected.length > 0 ? selected : rows.filter((row) => row.is_base);
  return useRows.map((row) => {
    const converted = toBaseFactor(nodes, row.id);
    return {
      id: row.id,
      productId: row.product_id,
      name: row.name,
      packagingUnit: row.name,
      baseUnit: rows.find((item) => item.is_base)?.name ?? "pièce",
      conversionFactor: converted.ok ? converted.factor : 1,
      active: true,
      sellingPrice: row.selling_price,
      allowDecimal: Boolean(row.allow_decimal),
    };
  });
}

export async function listCommerceUnitsForProducts(
  workspace: WorkspaceContext,
  productIds: string[],
  mode: "purchase" | "sale" = "purchase",
): Promise<Record<string, ProductPackaging[]>> {
  if (productIds.length === 0) return {};
  const supabase = await getPackagingReadClient(workspace);
  const selectWithVariant =
    "id, product_id, variant_id, name, parent_id, contains_qty, is_base, purchasable, sellable, selling_price, purchase_price, allow_decimal";
  const selectPlain =
    "id, product_id, name, parent_id, contains_qty, is_base, purchasable, sellable, selling_price, purchase_price, allow_decimal";
  let { data, error } = await supabase
    .from("product_unit_levels")
    .select(selectWithVariant)
    .in("product_id", productIds)
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("sort_order");
  if (error) {
    const fallback = await supabase
      .from("product_unit_levels")
      .select(selectPlain)
      .in("product_id", productIds)
      .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
      .order("sort_order");
    data = fallback.data;
    error = fallback.error;
  }
  if (error || !data) return {};
  const byProduct: Record<string, UnitLevelRow[]> = {};
  for (const row of data as UnitLevelRow[]) {
    if (!byProduct[row.product_id]) byProduct[row.product_id] = [];
    byProduct[row.product_id]!.push(row);
  }
  const result: Record<string, ProductPackaging[]> = {};
  for (const [productId, rows] of Object.entries(byProduct)) {
    result[productId] = unitLevelsToPackagings(pickProductUnitTree(rows), mode);
  }
  return result;
}

export async function listPackagingsForProductsMerged(
  workspace: WorkspaceContext,
  productIds: string[],
): Promise<Record<string, ProductPackaging[]>> {
  const [classic, commerce] = await Promise.all([
    listPackagingsForProducts(workspace, productIds),
    listCommerceUnitsForProducts(workspace, productIds, "purchase"),
  ]);
  const result = { ...classic };
  for (const [productId, units] of Object.entries(commerce)) {
    if (units.length > 0) result[productId] = units;
  }
  return result;
}

export async function getPackagingForValidation(
  workspace: WorkspaceContext,
  packagingId: string,
  productId: string,
): Promise<ProductPackaging | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_packagings")
    .select("id, product_id, name, packaging_unit, base_unit, conversion_factor, active")
    .eq("id", packagingId)
    .eq("product_id", productId)
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapPackaging(data as PackagingRow);
}
