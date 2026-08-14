"use server";

import { slugifyFromName } from "@/lib/auth/slugs";
import { requireProductManagementMutationContext } from "@/lib/auth/workspace-context";
import { isHardwareActivity } from "@/lib/hardware/activity";
import { hardwarePermissions } from "@/lib/hardware/permissions";
import {
  firstPurchasablePrice,
  firstSellablePrice,
  type PackagingNode,
  validatePackagingGraph,
} from "@/lib/hardware/product-engine";
import { ensureHardwareAttributes, getHardwareProductDraft, listHardwareBrands, listHardwareAttributes } from "@/lib/hardware/product-catalog-queries";
import type { HardwareProductDraft, HardwareUnitLevel } from "@/lib/hardware/product-catalog-types";
import { revalidateCatalogOps } from "@/lib/ops/revalidate";
import { ensureStockItemForBarProduct } from "@/lib/bar/ensure-stock";
import { getDepartmentIdByCode } from "@/lib/products/queries";
import { uploadProductImageFile } from "@/lib/products/upload-product-image";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProductUnit } from "@/lib/products/schemas";

function getWriteClient() {
  if (isAdminClientConfigured()) return createAdminClient();
  return null;
}

async function requireHardwareCatalog() {
  const workspace = await requireProductManagementMutationContext();
  if (!isHardwareActivity(workspace.activityCode)) {
    return { error: "Cette action est réservée à la quincaillerie." as const };
  }
  const allowed = hardwarePermissions({
    activityCode: workspace.activityCode,
    userSpace: workspace.userSpace,
    organizationRole: workspace.organizationRole,
    establishmentRole: workspace.establishmentRole,
  }).canManageCatalog;
  if (!allowed) {
    return { error: "Permission insuffisante pour gérer le catalogue." as const };
  }
  return { workspace };
}

function resolvedStockUnit(draft: HardwareProductDraft): string {
  const custom = draft.customStockUnit.trim();
  if (draft.stockUnit === "__custom__") return custom || "pièce";
  return (draft.stockUnit || custom || "pièce").trim();
}

function mapLabelToProductUnit(label: string): ProductUnit {
  const n = label.toLowerCase();
  if (n.includes("mètre") || n.includes("metre") || n === "m" || n === "cm") return "METER";
  if (n.includes("kg") || n.includes("kilo") || n.includes("gramme")) return "KG";
  if (n.includes("litre") || n === "l") return "LITER";
  if (n.includes("sachet")) return "SACHET";
  if (n === "sac" || n.includes("sac ")) return "PIECE";
  if (n.includes("barre")) return "BARRE";
  if (n.includes("feuille")) return "SHEET";
  if (n.includes("rouleau")) return "ROLL";
  if (n.includes("tonne")) return "TONNE";
  if (n.includes("carton")) return "CARTON";
  if (n.includes("pot") || n.includes("bidon")) return "JERRYCAN";
  return "PIECE";
}

function unitsToNodes(units: HardwareUnitLevel[]): PackagingNode[] {
  return units.map((unit) => ({
    id: unit.clientId,
    name: unit.name,
    parentId: unit.parentClientId,
    containsQty: unit.containsQty,
    purchasable: unit.purchasable,
    sellable: unit.sellable,
    purchasePrice: unit.purchasePrice,
    sellingPrice: unit.sellingPrice,
  }));
}

function validateDraft(draft: HardwareProductDraft): string | null {
  if (draft.name.trim().length < 2) return "Indiquez le nom du produit (au moins 2 caractères).";
  if (!draft.categoryId || draft.categoryId === "__new__") {
    if (draft.newCategoryName.trim().length < 2) {
      return "Choisissez une catégorie ou créez-en une.";
    }
  }
  const stockUnit = resolvedStockUnit(draft);
  if (stockUnit.length < 1) return "Indiquez l’unité de stock.";
  if (draft.fractionable) {
    if (!Number.isFinite(draft.fractionPrecision) || draft.fractionPrecision <= 0) {
      return "Indiquez une précision supérieure à 0 (ex. 0,1).";
    }
  }
  if (draft.useVariants) {
    if (draft.variants.length === 0) return "Ajoutez au moins une variante, ou désactivez les variantes.";
    for (const variant of draft.variants) {
      if (!variant.attributeValue.trim()) return "Chaque variante doit avoir une valeur.";
      const graph = validatePackagingGraph(unitsToNodes(syncBaseName(variant.units, stockUnit)));
      if (!graph.ok) return graph.error;
    }
  } else {
    const graph = validatePackagingGraph(unitsToNodes(syncBaseName(draft.units, stockUnit)));
    if (!graph.ok) return graph.error;
  }
  return null;
}

function syncBaseName(units: HardwareUnitLevel[], stockUnit: string): HardwareUnitLevel[] {
  return units.map((unit) =>
    unit.isBase || unit.clientId === "base" ? { ...unit, name: stockUnit, parentClientId: null, containsQty: 1 } : unit,
  );
}

async function resolveBrandId(
  workspace: Awaited<ReturnType<typeof requireProductManagementMutationContext>>,
  draft: HardwareProductDraft,
): Promise<string | null | { error: string }> {
  const supabase = getWriteClient() ?? (await createClient());
  if (draft.newBrandName.trim().length >= 2) {
    const name = draft.newBrandName.trim();
    const { data: existing } = await supabase
      .from("product_brands")
      .select("id")
      .eq("establishment_id", workspace.establishmentId)
      .ilike("name", name)
      .maybeSingle();
    if (existing?.id) return existing.id;
    const { data, error } = await supabase
      .from("product_brands")
      .insert({
        organization_id: workspace.organizationId,
        establishment_id: workspace.establishmentId,
        name,
        active: true,
        created_by: workspace.userId,
        updated_by: workspace.userId,
      })
      .select("id")
      .maybeSingle();
    if (error || !data?.id) return { error: "Impossible de créer la marque." };
    return data.id;
  }
  return draft.brandId && draft.brandId !== "__new__" ? draft.brandId : null;
}

async function insertUnitLevels(
  workspace: Awaited<ReturnType<typeof requireProductManagementMutationContext>>,
  productId: string,
  variantId: string | null,
  units: HardwareUnitLevel[],
  stockUnit: string,
) {
  const supabase = getWriteClient() ?? (await createClient());
  const synced = syncBaseName(units, stockUnit);
  const clientToDb = new Map<string, string>();
  const remaining = [...synced];
  let guard = 0;
  while (remaining.length > 0 && guard < 40) {
    guard += 1;
    const readyIndex = remaining.findIndex(
      (unit) => !unit.parentClientId || clientToDb.has(unit.parentClientId),
    );
    if (readyIndex < 0) break;
    const [unit] = remaining.splice(readyIndex, 1);
    if (!unit) break;
    const { data, error } = await supabase
      .from("product_unit_levels")
      .insert({
        organization_id: workspace.organizationId,
        establishment_id: workspace.establishmentId,
        product_id: productId,
        variant_id: variantId,
        name: unit.name.trim(),
        parent_id: unit.parentClientId ? clientToDb.get(unit.parentClientId) ?? null : null,
        contains_qty: unit.containsQty,
        is_base: Boolean(unit.isBase || unit.clientId === "base"),
        purchasable: unit.purchasable,
        sellable: unit.sellable,
        purchase_price: unit.purchasable ? Math.round(unit.purchasePrice || 0) : null,
        selling_price: unit.sellable ? Math.round(unit.sellingPrice || 0) : null,
        sort_order: unit.isBase ? 0 : guard,
        created_by: workspace.userId,
        updated_by: workspace.userId,
      })
      .select("id")
      .maybeSingle();
    if (error || !data?.id) {
      throw new Error(error?.message ?? "Impossible d’enregistrer un conditionnement.");
    }
    clientToDb.set(unit.clientId, data.id);
  }
}

export async function listHardwareCatalogMetaAction() {
  const gate = await requireHardwareCatalog();
  if ("error" in gate && gate.error) return { error: gate.error, brands: [], attributes: [] };
  const workspace = "workspace" in gate ? gate.workspace : null;
  if (!workspace) return { error: "Session invalide.", brands: [], attributes: [] };
  const [brands, attributes] = await Promise.all([
    listHardwareBrands(workspace),
    ensureHardwareAttributes(workspace),
  ]);
  return { brands, attributes };
}

export async function loadHardwareProductDraftAction(productId: string) {
  const gate = await requireHardwareCatalog();
  if ("error" in gate && gate.error) return { error: gate.error };
  const draft = await getHardwareProductDraft(gate.workspace, productId);
  if (!draft) return { error: "Produit introuvable." };
  return { draft };
}

export async function createHardwareBrandAction(name: string) {
  const gate = await requireHardwareCatalog();
  if ("error" in gate && gate.error) return { error: gate.error };
  const trimmed = name.trim();
  if (trimmed.length < 2) return { error: "Indiquez le nom de la marque." };
  const supabase = getWriteClient() ?? (await createClient());
  const { data, error } = await supabase
    .from("product_brands")
    .insert({
      organization_id: gate.workspace.organizationId,
      establishment_id: gate.workspace.establishmentId,
      name: trimmed,
      active: true,
      created_by: gate.workspace.userId,
      updated_by: gate.workspace.userId,
    })
    .select("id, name, logo_url, active")
    .maybeSingle();
  if (error) {
    if (error.message.toLowerCase().includes("duplicate") || error.code === "23505") {
      const existing = await listHardwareBrands(gate.workspace);
      const found = existing.find((item) => item.name.toLowerCase() === trimmed.toLowerCase());
      if (found) return { brand: found };
    }
    return { error: "Impossible de créer la marque." };
  }
  return {
    brand: {
      id: data!.id,
      name: data!.name,
      logoUrl: data!.logo_url,
      active: data!.active,
    },
  };
}

export async function createHardwareAttributeAction(name: string) {
  const gate = await requireHardwareCatalog();
  if ("error" in gate && gate.error) return { error: gate.error };
  const trimmed = name.trim();
  if (trimmed.length < 2) return { error: "Indiquez le nom de l’attribut." };
  const supabase = getWriteClient() ?? (await createClient());
  const { data, error } = await supabase
    .from("product_attributes")
    .insert({
      organization_id: gate.workspace.organizationId,
      establishment_id: gate.workspace.establishmentId,
      name: trimmed,
      active: true,
      created_by: gate.workspace.userId,
      updated_by: gate.workspace.userId,
    })
    .select("id, name, active")
    .maybeSingle();
  if (error) {
    const existing = await listHardwareAttributes(gate.workspace);
    const found = existing.find((item) => item.name.toLowerCase() === trimmed.toLowerCase());
    if (found) return { attribute: found };
    return { error: "Impossible de créer l’attribut." };
  }
  return { attribute: { id: data!.id, name: data!.name, active: data!.active } };
}

export async function saveHardwareProductAction(
  formData: FormData,
): Promise<{ error?: string; success?: string; productId?: string }> {
  const gate = await requireHardwareCatalog();
  if ("error" in gate && gate.error) return { error: gate.error };
  const workspace = gate.workspace;

  let draft: HardwareProductDraft;
  try {
    draft = JSON.parse(String(formData.get("draft") ?? "{}")) as HardwareProductDraft;
  } catch {
    return { error: "Données produit invalides." };
  }

  const invalid = validateDraft(draft);
  if (invalid) return { error: invalid };

  const stockUnit = resolvedStockUnit(draft);
  const departmentId = await getDepartmentIdByCode(workspace, "BAR");
  if (!departmentId) return { error: "Département magasin introuvable." };

  let categoryId = draft.categoryId === "__new__" ? "" : draft.categoryId;
  const supabase = getWriteClient() ?? (await createClient());
  if (!categoryId && draft.newCategoryName.trim()) {
    const name = draft.newCategoryName.trim();
    const slug = slugifyFromName(name);
    const { data, error } = await supabase
      .from("categories")
      .insert({
        organization_id: workspace.organizationId,
        establishment_id: workspace.establishmentId,
        department_id: departmentId,
        name,
        slug,
        active: true,
      })
      .select("id")
      .maybeSingle();
    if (error || !data?.id) return { error: "Impossible de créer la catégorie." };
    categoryId = data.id;
  }

  const brandResult = await resolveBrandId(workspace, draft);
  if (brandResult && typeof brandResult === "object" && "error" in brandResult) {
    return { error: brandResult.error };
  }
  const brandId = typeof brandResult === "string" ? brandResult : null;

  const imageFile = formData.get("imageOriginal");
  let imageUrl: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await uploadProductImageFile(workspace, imageFile);
    if ("error" in uploaded) return { error: uploaded.error };
    imageUrl = uploaded.url;
  }

  const priceNodes = unitsToNodes(
    syncBaseName(
      draft.useVariants ? (draft.variants[0]?.units ?? draft.units) : draft.units,
      stockUnit,
    ),
  );
  const sellingPrice = firstSellablePrice(priceNodes);
  const purchasePrice = firstPurchasablePrice(priceNodes);
  const slugBase = slugifyFromName(draft.name.trim()) || "article";
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const productPayload = {
    organization_id: workspace.organizationId,
    establishment_id: workspace.establishmentId,
    department_id: departmentId,
    category_id: categoryId,
    name: draft.name.trim(),
    slug,
    description: draft.description.trim() || null,
    selling_price: sellingPrice,
    unit: mapLabelToProductUnit(stockUnit),
    minimum_stock: Math.max(0, Math.round(draft.minimumStock || 0)),
    active: true,
    created_by: workspace.userId,
    updated_by: workspace.userId,
    brand_id: brandId,
    model_name: draft.modelName.trim() || null,
    internal_ref: draft.internalRef.trim() || null,
    stock_unit_label: stockUnit,
    fractionable: draft.fractionable,
    fraction_precision: draft.fractionable ? draft.fractionPrecision : null,
    purchase_price: purchasePrice || null,
    wholesale_price: null,
    ...(imageUrl
      ? {
          image_url: imageUrl,
          image_original_url: imageUrl,
        }
      : {}),
  };

  let productId = draft.productId ?? null;

  try {
    if (productId) {
      const { slug: _slug, created_by: _created, ...updatePayload } = productPayload;
      void _slug;
      void _created;
      const { error } = await supabase
        .from("products")
        .update({ ...updatePayload, updated_by: workspace.userId })
        .eq("id", productId)
        .eq("establishment_id", workspace.establishmentId);
      if (error) return { error: error.message };

      await supabase
        .from("product_unit_levels")
        .delete()
        .eq("product_id", productId)
        .eq("establishment_id", workspace.establishmentId);

      const keepVariantIds = draft.useVariants
        ? draft.variants.map((item) => item.id).filter(Boolean)
        : [];
      const { data: existingVariants } = await supabase
        .from("product_variants")
        .select("id")
        .eq("product_id", productId);
      const toDelete = (existingVariants ?? [])
        .map((row) => row.id)
        .filter((id) => !keepVariantIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from("product_variants").delete().in("id", toDelete);
      }
      if (!draft.useVariants) {
        await supabase.from("product_variants").delete().eq("product_id", productId);
      }
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert({ ...productPayload, slug })
        .select("id")
        .maybeSingle();
      if (error || !data?.id) return { error: error?.message ?? "Création impossible." };
      productId = data.id;
    }

    if (!productId) return { error: "Produit introuvable." };

    if (draft.useVariants) {
      for (const variant of draft.variants) {
        const variantName = variant.attributeValue.trim();
        let variantId = variant.id ?? null;
        if (variantId) {
          await supabase
            .from("product_variants")
            .update({
              name: variantName,
              attribute_id: variant.attributeId || null,
              attribute_value: variantName,
              internal_ref: variant.internalRef.trim() || null,
              minimum_stock: Math.max(0, Math.round(variant.minimumStock || 0)),
              selling_price: firstSellablePrice(unitsToNodes(syncBaseName(variant.units, stockUnit))),
              updated_by: workspace.userId,
            })
            .eq("id", variantId)
            .eq("establishment_id", workspace.establishmentId);
        } else {
          const { data, error } = await supabase
            .from("product_variants")
            .insert({
              organization_id: workspace.organizationId,
              establishment_id: workspace.establishmentId,
              product_id: productId,
              name: variantName,
              attribute_id: variant.attributeId || null,
              attribute_value: variantName,
              internal_ref: variant.internalRef.trim() || null,
              minimum_stock: Math.max(0, Math.round(variant.minimumStock || 0)),
              selling_price: firstSellablePrice(unitsToNodes(syncBaseName(variant.units, stockUnit))),
              active: true,
              created_by: workspace.userId,
              updated_by: workspace.userId,
            })
            .select("id")
            .maybeSingle();
          if (error || !data?.id) return { error: error?.message ?? "Variante impossible." };
          variantId = data.id;
        }
        await insertUnitLevels(workspace, productId, variantId, variant.units, stockUnit);
      }
    } else {
      await insertUnitLevels(workspace, productId, null, draft.units, stockUnit);
    }

    await ensureStockItemForBarProduct(workspace, {
      id: productId,
      name: draft.name.trim(),
      unit: mapLabelToProductUnit(stockUnit),
      minimumStock: Math.max(0, Math.round(draft.minimumStock || 0)),
      active: true,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Enregistrement impossible.",
    };
  }

  revalidateCatalogOps();
  return {
    success: draft.productId ? "Article mis à jour." : "Article créé.",
    productId,
  };
}
