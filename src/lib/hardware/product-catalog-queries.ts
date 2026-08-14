import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { HARDWARE_ATTRIBUTE_SUGGESTIONS } from "@/lib/hardware/product-catalog-constants";
import type {
  HardwareAttribute,
  HardwareBrand,
  HardwareProductDraft,
  HardwareUnitLevel,
  HardwareVariantDraft,
} from "@/lib/hardware/product-catalog-types";
import { emptyHardwareUnits } from "@/lib/hardware/product-catalog-types";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function writeClient() {
  if (isAdminClientConfigured()) return createAdminClient();
  return null;
}

async function client(workspace: WorkspaceContext) {
  return writeClient() ?? (await createClient());
  void workspace;
}

export async function listHardwareBrands(
  workspace: WorkspaceContext,
): Promise<HardwareBrand[]> {
  const supabase = await client(workspace);
  const { data, error } = await supabase
    .from("product_brands")
    .select("id, name, logo_url, active")
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("name");
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    active: row.active,
  }));
}

export async function listHardwareAttributes(
  workspace: WorkspaceContext,
): Promise<HardwareAttribute[]> {
  const supabase = await client(workspace);
  const { data, error } = await supabase
    .from("product_attributes")
    .select("id, name, active")
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("name");
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
  }));
}

export async function ensureHardwareAttributes(
  workspace: WorkspaceContext,
): Promise<HardwareAttribute[]> {
  const existing = await listHardwareAttributes(workspace);
  if (existing.length > 0) return existing;
  const supabase = await client(workspace);
  const rows = HARDWARE_ATTRIBUTE_SUGGESTIONS.map((name) => ({
    organization_id: workspace.organizationId,
    establishment_id: workspace.establishmentId,
    name,
    active: true,
    created_by: workspace.userId,
    updated_by: workspace.userId,
  }));
  await supabase.from("product_attributes").insert(rows);
  return listHardwareAttributes(workspace);
}

function mapUnits(
  rows: Array<Record<string, unknown>>,
  variantId: string | null,
): HardwareUnitLevel[] {
  const scoped = rows.filter((row) =>
    variantId ? row.variant_id === variantId : !row.variant_id,
  );
  const idToClient = new Map<string, string>();
  scoped.forEach((row, index) => {
    const isBase = Boolean(row.is_base);
    idToClient.set(String(row.id), isBase ? "base" : `u-${index}-${String(row.id).slice(0, 8)}`);
  });
  return scoped.map((row, index) => {
    const isBase = Boolean(row.is_base);
    const parentId = row.parent_id ? String(row.parent_id) : null;
    return {
      clientId: isBase ? "base" : `u-${index}-${String(row.id).slice(0, 8)}`,
      id: String(row.id),
      name: String(row.name),
      parentClientId: parentId ? (idToClient.get(parentId) ?? null) : null,
      containsQty: Number(row.contains_qty ?? 1),
      isBase,
      purchasable: Boolean(row.purchasable),
      sellable: Boolean(row.sellable),
      purchasePrice: Number(row.purchase_price ?? 0),
      sellingPrice: Number(row.selling_price ?? 0),
    };
  });
}

export async function getHardwareProductDraft(
  workspace: WorkspaceContext,
  productId: string,
): Promise<HardwareProductDraft | null> {
  const supabase = await client(workspace);
  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, name, category_id, brand_id, model_name, internal_ref, description, stock_unit_label, fractionable, fraction_precision, minimum_stock, image_url, image_original_url",
    )
    .eq("id", productId)
    .eq("establishment_id", workspace.establishmentId)
    .maybeSingle();
  if (error || !product) return null;

  const [{ data: variants }, { data: units }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, attribute_id, attribute_value, internal_ref, minimum_stock, name")
      .eq("product_id", productId)
      .eq("establishment_id", workspace.establishmentId)
      .order("created_at"),
    supabase
      .from("product_unit_levels")
      .select(
        "id, variant_id, name, parent_id, contains_qty, is_base, purchasable, sellable, purchase_price, selling_price, sort_order",
      )
      .eq("product_id", productId)
      .eq("establishment_id", workspace.establishmentId)
      .order("sort_order"),
  ]);

  const unitRows = (units ?? []) as Array<Record<string, unknown>>;
  const variantRows = variants ?? [];
  const useVariants = variantRows.length > 0;
  const stockUnit = product.stock_unit_label || "pièce";

  const variantDrafts: HardwareVariantDraft[] = variantRows.map((row) => ({
    clientId: row.id,
    id: row.id,
    attributeId: row.attribute_id ?? "",
    attributeValue: row.attribute_value || row.name,
    internalRef: row.internal_ref ?? "",
    minimumStock: row.minimum_stock ?? 0,
    units: mapUnits(unitRows, row.id),
  }));

  return {
    productId: product.id,
    imageUrl: product.image_original_url || product.image_url,
    name: product.name,
    categoryId: product.category_id ?? "",
    newCategoryName: "",
    brandId: product.brand_id ?? "",
    newBrandName: "",
    modelName: product.model_name ?? "",
    internalRef: product.internal_ref ?? "",
    description: product.description ?? "",
    stockUnit,
    customStockUnit: "",
    fractionable: Boolean(product.fractionable),
    fractionPrecision: Number(product.fraction_precision ?? 0.1),
    minimumStock: product.minimum_stock ?? 0,
    useVariants,
    variants: variantDrafts,
    units: useVariants
      ? emptyHardwareUnits(stockUnit)
      : mapUnits(unitRows, null).length > 0
        ? mapUnits(unitRows, null)
        : emptyHardwareUnits(stockUnit),
  };
}
