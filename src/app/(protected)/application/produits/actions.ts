"use server";

import { revalidatePath } from "next/cache";

import { mapGenericError } from "@/lib/auth/errors";
import { slugifyFromName } from "@/lib/auth/slugs";
import { isRetailActivity } from "@/lib/activity/profile";
import { requireProductManagementMutationContext } from "@/lib/auth/workspace-context";
import { ensureStockItemForBarProduct } from "@/lib/bar/ensure-stock";
import { getLocalProductImage } from "@/lib/fasobar/product-images";
import { revalidateCatalogOps } from "@/lib/ops/revalidate";
import {
  getDepartmentIdByCode,
  validateCategoryForDepartment,
} from "@/lib/products/queries";
import { packagingDisplayName } from "@/lib/products/constants";
import { isDepartmentAllowed } from "@/lib/settings/service-scope";
import {
  createProductSchema,
  toggleProductStatusSchema,
  updateProductPriceSchema,
  updateProductSchema,
} from "@/lib/products/schemas";
import type { ProductActionState } from "@/lib/products/types";
import { uploadProductImageFile } from "@/lib/products/upload-product-image";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PRODUCTS_PATH = "/application/produits";

function revalidateProductsPage() {
  revalidatePath(PRODUCTS_PATH);
  revalidateCatalogOps();
}

/** Client d'écriture : service role si dispo (après contrôle app), sinon session user. */
function getProductWriteClient() {
  if (isAdminClientConfigured()) {
    return createAdminClient();
  }
  return null;
}

function isRlsError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42501" ||
    message.includes("row-level security") ||
    message.includes("rls")
  );
}

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

async function createCategoryForDepartment(
  workspace: Awaited<ReturnType<typeof requireProductManagementMutationContext>>,
  departmentId: string,
  name: string,
): Promise<{ id: string } | { error: string }> {
  const slug = slugifyFromName(name);
  if (!slug) {
    return { error: "Le nom de catégorie produit un identifiant invalide." };
  }

  const supabase = await createClient();
  const writeClient = getProductWriteClient() ?? supabase;
  const payload = {
    organization_id: workspace.organizationId,
    establishment_id: workspace.establishmentId,
    department_id: departmentId,
    name: name.trim(),
    slug,
    active: true,
  };

  const inserted = await writeClient
    .from("categories")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (!inserted.error && inserted.data?.id) {
    return { id: inserted.data.id };
  }

  const existing = await supabase
    .from("categories")
    .select("id")
    .eq("establishment_id", workspace.establishmentId)
    .eq("department_id", departmentId)
    .eq("slug", slug)
    .maybeSingle();

  if (existing.data?.id) {
    return { id: existing.data.id };
  }

  return {
    error: inserted.error?.message || "Impossible de créer la catégorie.",
  };
}

function readNamedImageFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) {
    return null;
  }
  return value;
}

type ResolvedProductImages = {
  imageUrl: string | null;
  imageOriginalUrl: string | null;
  imageOptimizedUrl: string | null;
  warning?: string;
};

async function resolveProductImagesFromForm(
  workspace: Awaited<ReturnType<typeof requireProductManagementMutationContext>>,
  formData: FormData,
  productName: string,
  existing?: {
    imageUrl?: string | null;
    imageOriginalUrl?: string | null;
    imageOptimizedUrl?: string | null;
  },
): Promise<ResolvedProductImages> {
  const originalFile = readNamedImageFile(formData, "imageOriginal");
  const optimizedFile = readNamedImageFile(formData, "imageOptimized");
  const legacyFile = readNamedImageFile(formData, "image");
  const selection = String(formData.get("imageSelection") || "optimized");

  let imageOriginalUrl = existing?.imageOriginalUrl ?? null;
  let imageOptimizedUrl = existing?.imageOptimizedUrl ?? null;
  let warning: string | undefined;

  if (originalFile) {
    const uploaded = await uploadProductImageFile(workspace, originalFile);
    if ("error" in uploaded) {
      warning = uploaded.error;
    } else {
      imageOriginalUrl = uploaded.url;
    }
  }

  if (optimizedFile) {
    const uploaded = await uploadProductImageFile(workspace, optimizedFile);
    if ("error" in uploaded) {
      warning = warning ?? uploaded.error;
    } else {
      imageOptimizedUrl = uploaded.url;
    }
  } else if (legacyFile && !originalFile) {
    // Compat : ancien champ unique « image » traité comme originale + affichage.
    const uploaded = await uploadProductImageFile(workspace, legacyFile);
    if ("error" in uploaded) {
      warning = warning ?? uploaded.error;
    } else {
      imageOriginalUrl = uploaded.url;
      if (selection === "optimized") {
        imageOptimizedUrl = uploaded.url;
      }
    }
  }

  let imageUrl =
    selection === "original"
      ? imageOriginalUrl ?? imageOptimizedUrl
      : imageOptimizedUrl ?? imageOriginalUrl;

  if (!imageUrl) {
    imageUrl =
      existing?.imageOptimizedUrl ??
      existing?.imageOriginalUrl ??
      existing?.imageUrl ??
      getLocalProductImage(productName);
  }

  if (!imageOriginalUrl && imageUrl) {
    imageOriginalUrl = existing?.imageOriginalUrl ?? imageUrl;
  }

  return {
    imageUrl,
    imageOriginalUrl,
    imageOptimizedUrl,
    warning,
  };
}

function mapProductWriteError(error: { message?: string; code?: string } | null): string {
  if (!error?.message && !error?.code) {
    return "Une erreur inattendue est survenue. Veuillez réessayer.";
  }

  const message = (error.message ?? "").toLowerCase();

  if (
    error.code === "23505" ||
    message.includes("duplicate") ||
    message.includes("unique")
  ) {
    return "Un produit avec ce nom existe déjà dans cet établissement.";
  }

  if (message.includes("row-level security") || message.includes("rls")) {
    return "Permission insuffisante pour créer ce produit.";
  }

  if (message.includes("invalid input value for enum") || message.includes("product_unit")) {
    return "Unité de stock non reconnue. Appliquez la migration des unités (bidon, sachet, carton) ou choisissez Bouteille / Canette.";
  }

  if (message.includes("image_url")) {
    return "Colonne image non disponible. Réessayez sans image ou appliquez la migration images.";
  }

  return error.message || mapGenericError(error);
}

export async function createProductAction(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const workspace = await requireProductManagementMutationContext();

  const parsed = createProductSchema.safeParse({
    name: formData.get("name"),
    departmentCode: formData.get("departmentCode"),
    categoryId: formData.get("categoryId"),
    newCategoryName: formData.get("newCategoryName") || undefined,
    catalogKind: formData.get("catalogKind") || undefined,
    sellingPrice: formData.get("sellingPrice"),
    unit: formData.get("unit"),
    minimumStock: formData.get("minimumStock"),
    description: formData.get("description") || undefined,
    active: parseCheckbox(formData.get("active")),
    packagingUnit: formData.get("packagingUnit") || undefined,
    unitsPerPack: formData.get("unitsPerPack") || undefined,
    sku: formData.get("sku") || undefined,
    barcode: formData.get("barcode") || undefined,
    purchasePrice: formData.get("purchasePrice") || undefined,
    wholesalePrice: formData.get("wholesalePrice") || undefined,
    purchaseUnit: formData.get("purchaseUnit") || undefined,
    unitsPerPurchase: formData.get("unitsPerPurchase") || undefined,
    discountMinQuantity: formData.get("discountMinQuantity") || undefined,
    discountPercent: formData.get("discountPercent") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (!isDepartmentAllowed(workspace.serviceScope, parsed.data.departmentCode)) {
    return {
      error:
        "Ce département n’est pas ouvert pour cet établissement. Modifiez les espaces dans Paramètres.",
    };
  }

  const departmentId = await getDepartmentIdByCode(
    workspace,
    parsed.data.departmentCode,
  );

  if (!departmentId) {
    return { error: "Département introuvable pour cet établissement." };
  }

  let categoryId = parsed.data.categoryId ?? null;
  if (!categoryId && parsed.data.newCategoryName) {
    const created = await createCategoryForDepartment(
      workspace,
      departmentId,
      parsed.data.newCategoryName,
    );
    if ("error" in created) {
      return { error: created.error };
    }
    categoryId = created.id;
  }

  if (!categoryId) {
    return { error: "Sélectionnez une catégorie ou créez-en une." };
  }

  const categoryValid = await validateCategoryForDepartment(
    workspace,
    categoryId,
    departmentId,
  );

  if (!categoryValid) {
    return {
      error: isRetailActivity(workspace.activityCode)
        ? "Catégorie invalide pour ce magasin. Choisissez-en une autre ou créez-en une."
        : "La catégorie sélectionnée est invalide pour ce département. Choisissez une catégorie Boissons ou Nourriture adaptée.",
    };
  }

  const slug = (() => {
    try {
      return slugifyFromName(parsed.data.name);
    } catch {
      return null;
    }
  })();

  if (!slug) {
    return { error: "Le nom du produit produit un identifiant invalide." };
  }

  let imageUrl: string | null = null;
  let imageOriginalUrl: string | null = null;
  let imageOptimizedUrl: string | null = null;

  const images = await resolveProductImagesFromForm(workspace, formData, parsed.data.name);
  if (images.warning) {
    console.warn("[createProductAction] image:", images.warning);
  }
  imageUrl = images.imageUrl;
  imageOriginalUrl = images.imageOriginalUrl;
  imageOptimizedUrl = images.imageOptimizedUrl;

  const supabase = await createClient();
  // Droits déjà vérifiés via requireProductManagementMutationContext — service role pour un insert fiable.
  const writeClient = getProductWriteClient() ?? supabase;

  const payload = {
    organization_id: workspace.organizationId,
    establishment_id: workspace.establishmentId,
    department_id: departmentId,
    category_id: categoryId,
    name: parsed.data.name,
    slug,
    description: parsed.data.description ?? null,
    selling_price: parsed.data.sellingPrice,
    unit: parsed.data.unit,
    minimum_stock: parsed.data.minimumStock,
    active: parsed.data.active,
    image_url: imageUrl,
    image_original_url: imageOriginalUrl,
    image_optimized_url: imageOptimizedUrl,
    created_by: workspace.userId,
    updated_by: workspace.userId,
    sku: parsed.data.sku ?? null,
    barcode: parsed.data.barcode ?? null,
    purchase_price: parsed.data.purchasePrice ?? null,
    wholesale_price: parsed.data.wholesalePrice ?? null,
    purchase_unit:
      "purchaseUnit" in parsed.data
        ? ((parsed.data as { purchaseUnit?: string }).purchaseUnit ?? null)
        : null,
    units_per_purchase: parsed.data.unitsPerPurchase ?? null,
    discount_min_quantity: parsed.data.discountMinQuantity ?? null,
    discount_percent: parsed.data.discountPercent ?? null,
  };

  let createdId: string | null = null;

  {
    // 1) RPC SECURITY DEFINER (si migration appliquée)
    const rpcAttempt = await supabase.rpc("create_establishment_product", {
      p_establishment_id: workspace.establishmentId,
      p_department_id: departmentId,
      p_category_id: categoryId,
      p_name: parsed.data.name,
      p_slug: slug,
      p_selling_price: parsed.data.sellingPrice,
      p_unit: parsed.data.unit,
      p_minimum_stock: parsed.data.minimumStock,
      p_description: parsed.data.description ?? null,
      p_active: parsed.data.active,
      p_image_url: imageUrl,
      p_image_original_url: imageOriginalUrl,
      p_image_optimized_url: imageOptimizedUrl,
    });

    if (!rpcAttempt.error && rpcAttempt.data) {
      createdId =
        typeof rpcAttempt.data === "string" ? rpcAttempt.data : String(rpcAttempt.data);
    } else if (
      rpcAttempt.error &&
      !/Could not find the function|PGRST202|schema cache|does not exist/i.test(
        rpcAttempt.error.message,
      ) &&
      !isRlsError(rpcAttempt.error) &&
      !/permission insuffisante/i.test(rpcAttempt.error.message)
    ) {
      console.error("[createProductAction] rpc", rpcAttempt.error.message, rpcAttempt.error.code);
      return { error: mapProductWriteError(rpcAttempt.error) };
    } else if (rpcAttempt.error) {
      console.warn("[createProductAction] rpc fallback:", rpcAttempt.error.message);
    }

    const attemptInsert = async (row: Record<string, unknown>) =>
      writeClient.from("products").insert(row).select("id").maybeSingle();

    if (!createdId) {
      let { data, error } = await attemptInsert(payload);

      if (
        error &&
        (error.message.includes("image_original_url") ||
          error.message.includes("image_optimized_url"))
      ) {
        const {
          image_original_url: _o,
          image_optimized_url: _z,
          ...legacyPayload
        } = payload;
        void _o;
        void _z;
        ({ data, error } = await attemptInsert(legacyPayload));
      }

      if (error?.message?.includes("image_url")) {
        const {
          image_url: _u,
          image_original_url: _o,
          image_optimized_url: _z,
          ...withoutImages
        } = payload;
        void _u;
        void _o;
        void _z;
        ({ data, error } = await attemptInsert(withoutImages));
      }

      // Dernier recours : session utilisateur si service role a échoué bizarrement
      if (error && writeClient !== supabase) {
        console.warn("[createProductAction] service role failed, retry user client:", error.message);
        const userAttempt = await supabase.from("products").insert(payload).select("id").maybeSingle();
        if (!userAttempt.error && userAttempt.data?.id) {
          data = userAttempt.data;
          error = null;
        }
      }

      if (error) {
        console.error("[createProductAction] insert", error.message, error.code);
        return { error: mapProductWriteError(error) };
      }

      createdId = data?.id ?? null;
    }
  }

  if (!createdId) {
    console.error("[createProductAction] insert sans id retourné", { slug });
    return {
      error:
        "Échec de l'enregistrement du produit (aucun identifiant renvoyé). Vérifiez vos droits admin puis réessayez.",
    };
  }

  let packagingWarning: string | null = null;

  if (
    parsed.data.departmentCode === "BAR" &&
    parsed.data.packagingUnit &&
    parsed.data.unitsPerPack
  ) {
    const { error: packagingError } = await supabase.rpc("upsert_product_packaging", {
      p_product_id: createdId,
      p_name: packagingDisplayName(parsed.data.packagingUnit),
      p_packaging_unit: parsed.data.packagingUnit,
      p_conversion_factor: parsed.data.unitsPerPack,
      p_packaging_id: null,
    });

    if (packagingError) {
      const { error: insertPackError } = await writeClient.from("product_packagings").insert({
        organization_id: workspace.organizationId,
        establishment_id: workspace.establishmentId,
        product_id: createdId,
        name: packagingDisplayName(parsed.data.packagingUnit),
        packaging_unit: parsed.data.packagingUnit,
        base_unit: parsed.data.unit,
        conversion_factor: parsed.data.unitsPerPack,
        active: true,
        created_by: workspace.userId,
        updated_by: workspace.userId,
      });

      if (insertPackError) {
        console.warn(
          "[createProductAction] packaging:",
          packagingError.message,
          insertPackError.message,
        );
        packagingWarning =
          "Produit enregistré. Configurez le conditionnement (casier/carton/sachet) en modification du produit.";
      }
    }
  }

  // Produit BAR = article de stock (disponible pour les entrées / approvisionnements)
  if (parsed.data.departmentCode === "BAR") {
    const stockLink = await ensureStockItemForBarProduct(workspace, {
      id: createdId,
      name: parsed.data.name,
      unit: parsed.data.unit,
      minimumStock: parsed.data.minimumStock,
      active: parsed.data.active,
    });
    if ("error" in stockLink) {
      console.warn("[createProductAction] stock article:", stockLink.error);
    }
  }

  revalidateProductsPage();
  revalidatePath("/application/approvisionnements");
  revalidatePath("/application/bar/approvisionnements");
  revalidatePath("/application/stock");
  revalidatePath("/application/bar/stock");

  const retail = isRetailActivity(workspace.activityCode);
  return {
    success: packagingWarning
      ? `${packagingWarning} Disponible immédiatement en caisse${
          parsed.data.departmentCode === "BAR" && !retail ? " et dans l'espace bar" : ""
        }.`
      : retail
        ? "Article ajouté. Disponible immédiatement en caisse."
        : parsed.data.departmentCode === "BAR"
          ? "Article ajouté. Disponible en caisse et dans l'espace responsable bar."
          : "Article ajouté. Disponible immédiatement en caisse–cuisine.",
  };
}

export async function updateProductAction(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const workspace = await requireProductManagementMutationContext();

  const parsed = updateProductSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    departmentCode: formData.get("departmentCode"),
    categoryId: formData.get("categoryId"),
    sellingPrice: formData.get("sellingPrice"),
    unit: formData.get("unit"),
    minimumStock: formData.get("minimumStock"),
    description: formData.get("description") || undefined,
    active: parseCheckbox(formData.get("active")),
    sku: formData.get("sku") || undefined,
    barcode: formData.get("barcode") || undefined,
    purchasePrice: formData.get("purchasePrice") || undefined,
    wholesalePrice: formData.get("wholesalePrice") || undefined,
    purchaseUnit: formData.get("purchaseUnit") || undefined,
    unitsPerPurchase: formData.get("unitsPerPurchase") || undefined,
    discountMinQuantity: formData.get("discountMinQuantity") || undefined,
    discountPercent: formData.get("discountPercent") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (!isDepartmentAllowed(workspace.serviceScope, parsed.data.departmentCode)) {
    return {
      error:
        "Ce département n’est pas ouvert pour cet établissement. Modifiez les espaces dans Paramètres.",
    };
  }

  const departmentId = await getDepartmentIdByCode(
    workspace,
    parsed.data.departmentCode,
  );

  if (!departmentId) {
    return { error: "Département introuvable pour cet établissement." };
  }

  const categoryValid = await validateCategoryForDepartment(
    workspace,
    parsed.data.categoryId,
    departmentId,
  );

  if (!categoryValid) {
    return { error: "La catégorie sélectionnée est invalide." };
  }

  const slug = (() => {
    try {
      return slugifyFromName(parsed.data.name);
    } catch {
      return null;
    }
  })();

  if (!slug) {
    return { error: "Le nom du produit produit un identifiant invalide." };
  }

  const supabase = await createClient();
  const writeClient = getProductWriteClient() ?? supabase;

  const { data: existing } = await writeClient
    .from("products")
    .select("image_url, image_original_url, image_optimized_url")
    .eq("id", parsed.data.productId)
    .eq("establishment_id", workspace.establishmentId)
    .maybeSingle();

  const images = await resolveProductImagesFromForm(workspace, formData, parsed.data.name, {
    imageUrl: existing?.image_url ?? null,
    imageOriginalUrl:
      (existing as { image_original_url?: string | null } | null)?.image_original_url ?? null,
    imageOptimizedUrl:
      (existing as { image_optimized_url?: string | null } | null)?.image_optimized_url ?? null,
  });

  if (images.warning && !images.imageUrl) {
    return { error: images.warning };
  }

  const payload = {
    department_id: departmentId,
    category_id: parsed.data.categoryId,
    name: parsed.data.name,
    slug,
    description: parsed.data.description ?? null,
    selling_price: parsed.data.sellingPrice,
    unit: parsed.data.unit,
    minimum_stock: parsed.data.minimumStock,
    active: parsed.data.active,
    image_url: images.imageUrl,
    image_original_url: images.imageOriginalUrl,
    image_optimized_url: images.imageOptimizedUrl,
    updated_by: workspace.userId,
    sku: parsed.data.sku ?? null,
    barcode: parsed.data.barcode ?? null,
    purchase_price: parsed.data.purchasePrice ?? null,
    wholesale_price: parsed.data.wholesalePrice ?? null,
    purchase_unit:
      "purchaseUnit" in parsed.data
        ? ((parsed.data as { purchaseUnit?: string }).purchaseUnit ?? null)
        : null,
    units_per_purchase: parsed.data.unitsPerPurchase ?? null,
    discount_min_quantity: parsed.data.discountMinQuantity ?? null,
    discount_percent: parsed.data.discountPercent ?? null,
  };

  let { error } = await writeClient
    .from("products")
    .update(payload)
    .eq("id", parsed.data.productId)
    .eq("establishment_id", workspace.establishmentId);

  if (error?.message?.includes("image_original_url") || error?.message?.includes("image_optimized_url")) {
    const {
      image_original_url: _o,
      image_optimized_url: _z,
      ...legacyPayload
    } = payload;
    void _o;
    void _z;
    ({ error } = await writeClient
      .from("products")
      .update(legacyPayload)
      .eq("id", parsed.data.productId)
      .eq("establishment_id", workspace.establishmentId));
  }

  if (error?.message?.includes("image_url")) {
    const {
      image_url: removedImageUrl,
      image_original_url: _o,
      image_optimized_url: _z,
      ...withoutImage
    } = payload;
    void removedImageUrl;
    void _o;
    void _z;
    ({ error } = await writeClient
      .from("products")
      .update(withoutImage)
      .eq("id", parsed.data.productId)
      .eq("establishment_id", workspace.establishmentId));
  }

  if (error) {
    return { error: mapProductWriteError(error) };
  }

  if (parsed.data.departmentCode === "BAR" && parsed.data.active) {
    const stockLink = await ensureStockItemForBarProduct(workspace, {
      id: parsed.data.productId,
      name: parsed.data.name,
      unit: parsed.data.unit,
      minimumStock: parsed.data.minimumStock,
      active: parsed.data.active,
    });
    if ("error" in stockLink) {
      console.warn("[updateProductAction] stock article:", stockLink.error);
    }
  }

  revalidateProductsPage();
  return { success: "Produit mis à jour." };
}

export async function updateProductPriceAction(
  productId: string,
  sellingPrice: number,
): Promise<ProductActionState> {
  const workspace = await requireProductManagementMutationContext();

  const parsed = updateProductPriceSchema.safeParse({ productId, sellingPrice });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Prix invalide." };
  }

  const writeClient = getProductWriteClient() ?? (await createClient());

  const { error } = await writeClient
    .from("products")
    .update({
      selling_price: parsed.data.sellingPrice,
      updated_by: workspace.userId,
    })
    .eq("id", parsed.data.productId)
    .eq("establishment_id", workspace.establishmentId);

  if (error) {
    return { error: mapProductWriteError(error) };
  }

  revalidateProductsPage();
  return { success: "Prix mis à jour." };
}

export async function toggleProductStatusAction(
  productId: string,
  active: boolean,
): Promise<ProductActionState> {
  const workspace = await requireProductManagementMutationContext();

  const parsed = toggleProductStatusSchema.safeParse({ productId, active });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Action invalide." };
  }

  const writeClient = getProductWriteClient() ?? (await createClient());

  const { error } = await writeClient
    .from("products")
    .update({
      active: parsed.data.active,
      updated_by: workspace.userId,
    })
    .eq("id", parsed.data.productId)
    .eq("establishment_id", workspace.establishmentId);

  if (error) {
    return { error: mapProductWriteError(error) };
  }

  if (parsed.data.active) {
    const { data: productRow } = await writeClient
      .from("products")
      .select("id, name, unit, minimum_stock, departments(code)")
      .eq("id", parsed.data.productId)
      .eq("establishment_id", workspace.establishmentId)
      .maybeSingle();

    const department = Array.isArray(productRow?.departments)
      ? productRow.departments[0]
      : productRow?.departments;
    if (department && (department as { code?: string }).code === "BAR" && productRow) {
      const stockLink = await ensureStockItemForBarProduct(workspace, {
        id: productRow.id as string,
        name: productRow.name as string,
        unit: productRow.unit as string,
        minimumStock: (productRow.minimum_stock as number) ?? 0,
        active: true,
      });
      if ("error" in stockLink) {
        console.warn("[toggleProductStatusAction] stock article:", stockLink.error);
      }
    }
  }

  revalidateProductsPage();
  return {
    success: parsed.data.active
      ? "Produit activé."
      : "Produit désactivé.",
  };
}

export async function upsertPackagingAction(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  await requireProductManagementMutationContext();

  const { upsertPackagingSchema } = await import("@/lib/products/packaging-schemas");

  const parsed = upsertPackagingSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    packagingUnit: formData.get("packagingUnit"),
    conversionFactor: formData.get("conversionFactor"),
    packagingId: formData.get("packagingId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_product_packaging", {
    p_product_id: parsed.data.productId,
    p_name: parsed.data.name,
    p_packaging_unit: parsed.data.packagingUnit,
    p_conversion_factor: parsed.data.conversionFactor,
    p_packaging_id: parsed.data.packagingId ?? null,
  });

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) {
      return {
        error: "Migration conditionnements non appliquée. Contactez un administrateur technique.",
      };
    }
    return { error: error.message || mapGenericError(error) };
  }

  revalidateProductsPage();
  revalidatePath("/application/approvisionnements");
  revalidatePath("/application/bar/approvisionnements");
  return { success: "Conditionnement enregistré." };
}

export async function deactivatePackagingAction(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const workspace = await requireProductManagementMutationContext();

  const { deactivatePackagingSchema } = await import("@/lib/products/packaging-schemas");

  const parsed = deactivatePackagingSchema.safeParse({
    packagingId: formData.get("packagingId"),
    productId: formData.get("productId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_packagings")
    .update({ active: false, updated_by: workspace.userId })
    .eq("id", parsed.data.packagingId)
    .eq("product_id", parsed.data.productId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("organization_id", workspace.organizationId);

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) {
      return {
        error: "Migration conditionnements non appliquée. Contactez un administrateur technique.",
      };
    }
    return { error: error.message || mapGenericError(error) };
  }

  revalidateProductsPage();
  revalidatePath("/application/approvisionnements");
  revalidatePath("/application/bar/approvisionnements");
  return { success: "Conditionnement désactivé." };
}
