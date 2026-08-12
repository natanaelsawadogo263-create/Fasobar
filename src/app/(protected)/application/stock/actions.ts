"use server";

import { mapGenericError } from "@/lib/auth/errors";
import {
  requireStockManagementMutationContext,
  requireStockReadContext,
  type WorkspaceContext,
} from "@/lib/auth/workspace-context";
import { revalidateStockOps } from "@/lib/ops/revalidate";
import { getDepartmentIdByCode } from "@/lib/products/queries";
import { canManageDepartmentStock } from "@/lib/stock/constants";
import { isDepartmentAllowed } from "@/lib/settings/service-scope";
import { writeAuditLogEntry } from "@/lib/stock/audit";
import {
  findExistingStockItemForProduct,
  validateStockItemAccess,
  listStockMovements,
  getSupplierById,
  validateProductForStockLink,
} from "@/lib/stock/queries";
import {
  createStockItemSchema,
  createSupplierSchema,
  startInventorySchema,
  stockAdjustmentSchema,
  stockEntrySchema,
  stockLossSchema,
  toggleSupplierStatusSchema,
  updateSupplierSchema,
} from "@/lib/stock/schemas";
import type { StockActionState, StockMovementItem } from "@/lib/stock/types";
import { createClient } from "@/lib/supabase/server";

function revalidateStockPages() {
  revalidateStockOps();
}

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function assertDepartmentPermission(
  workspace: WorkspaceContext,
  departmentCode: string,
): string | null {
  if (
    (departmentCode === "BAR" || departmentCode === "KITCHEN") &&
    !isDepartmentAllowed(workspace.serviceScope, departmentCode)
  ) {
    return "Ce département n’est pas ouvert pour cet établissement.";
  }

  if (
    !canManageDepartmentStock(
      workspace.organizationRole,
      workspace.establishmentRole,
      departmentCode as "BAR" | "KITCHEN",
    )
  ) {
    return "Permission insuffisante pour ce département.";
  }

  return null;
}

export async function recordStockEntryAction(
  _prevState: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  const workspace = await requireStockManagementMutationContext();

  const rawUnitCost = formData.get("unitCost");
  const parsed = stockEntrySchema.safeParse({
    stockItemId: formData.get("stockItemId"),
    movementType: formData.get("movementType") || "PURCHASE",
    purchasedQuantity: formData.get("purchasedQuantity"),
    conversionFactor: formData.get("conversionFactor") || 1,
    unitCost:
      rawUnitCost === null || rawUnitCost === undefined || String(rawUnitCost).trim() === ""
        ? undefined
        : rawUnitCost,
    supplierId: formData.get("supplierId") || "",
    reference: formData.get("reference") || undefined,
    reason: formData.get("reason") || undefined,
    entryDate: formData.get("entryDate") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const stockItem = await validateStockItemAccess(workspace, parsed.data.stockItemId);

  if (!stockItem) {
    return { error: "Article de stock introuvable." };
  }

  const permissionError = assertDepartmentPermission(
    workspace,
    stockItem.departmentCode,
  );

  if (permissionError) {
    return { error: permissionError };
  }

  const stockQuantity =
    Math.round(parsed.data.purchasedQuantity * parsed.data.conversionFactor * 1000) /
    1000;

  const supabase = await createClient();

  const { error } = await supabase.rpc("record_stock_entry", {
    p_stock_item_id: parsed.data.stockItemId,
    p_movement_type: parsed.data.movementType,
    p_quantity: stockQuantity,
    p_purchased_quantity: parsed.data.purchasedQuantity,
    p_conversion_factor: parsed.data.conversionFactor,
    p_unit_cost: parsed.data.unitCost ?? null,
    p_supplier_id: parsed.data.supplierId || null,
    p_reference: parsed.data.reference ?? null,
    p_reason: parsed.data.reason ?? null,
  });

  if (error) {
    const message = error.message ?? "";

    if (message.includes("Permission insuffisante")) {
      return { error: "Permission insuffisante pour cette opération." };
    }

    if (message.includes("Stock insuffisant")) {
      return { error: "Stock insuffisant pour enregistrer cette perte." };
    }

    if (message.includes("Authentification requise")) {
      return { error: "Session expirée. Veuillez vous reconnecter." };
    }

    if (message.includes("Article de stock introuvable")) {
      return { error: "Article de stock introuvable." };
    }

    if (message.includes("Fournisseur invalide")) {
      return { error: "Fournisseur invalide ou inactif." };
    }

    if (message.includes("quantité") || message.includes("Quantité") || message.includes("coefficient")) {
      return { error: message };
    }

    console.error("[recordStockEntryAction]", message);
    return { error: message || mapGenericError(error) };
  }

  revalidateStockPages();
  return { success: "Entrée de stock enregistrée." };
}

export async function recordStockLossAction(
  _prevState: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  const workspace = await requireStockManagementMutationContext();

  const parsed = stockLossSchema.safeParse({
    stockItemId: formData.get("stockItemId"),
    movementType: formData.get("movementType"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const stockItem = await validateStockItemAccess(workspace, parsed.data.stockItemId);

  if (!stockItem) {
    return { error: "Article de stock introuvable." };
  }

  const permissionError = assertDepartmentPermission(
    workspace,
    stockItem.departmentCode,
  );

  if (permissionError) {
    return { error: permissionError };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("record_stock_loss", {
    p_stock_item_id: parsed.data.stockItemId,
    p_movement_type: parsed.data.movementType,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason,
  });

  if (error) {
    const message = error.message ?? "";

    if (message.includes("Stock insuffisant")) {
      return {
        error:
          "Stock insuffisant pour cette perte. Vérifiez la quantité disponible ou enregistrez d'abord une entrée.",
      };
    }

    if (message.includes("Permission insuffisante")) {
      return { error: "Permission insuffisante pour déclarer une perte." };
    }

    if (message.includes("Authentification requise")) {
      return { error: "Session expirée. Veuillez vous reconnecter." };
    }

    if (message.includes("quantité") || message.includes("Quantité")) {
      return { error: message };
    }

    console.error("[recordStockLossAction]", message);
    return { error: message || mapGenericError(error) };
  }

  revalidateStockPages();
  return { success: "Perte enregistrée." };
}

export async function adjustStockQuantityAction(
  _prevState: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  const workspace = await requireStockManagementMutationContext();

  const parsed = stockAdjustmentSchema.safeParse({
    stockItemId: formData.get("stockItemId"),
    newQuantity: formData.get("newQuantity"),
    reason: formData.get("reason"),
    confirmed: parseCheckbox(formData.get("confirmed")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (!parsed.data.confirmed) {
    return { error: "Veuillez confirmer la correction du stock." };
  }

  const stockItem = await validateStockItemAccess(workspace, parsed.data.stockItemId);

  if (!stockItem) {
    return { error: "Article de stock introuvable." };
  }

  const permissionError = assertDepartmentPermission(
    workspace,
    stockItem.departmentCode,
  );

  if (permissionError) {
    return { error: permissionError };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("adjust_stock_quantity", {
    p_stock_item_id: parsed.data.stockItemId,
    p_new_quantity: parsed.data.newQuantity,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return { error: mapGenericError(error) };
  }

  revalidateStockPages();
  return { success: "Stock corrigé." };
}

export async function createSupplierAction(
  _prevState: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  const workspace = await requireStockManagementMutationContext();

  const parsed = createSupplierSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
    departmentCode: formData.get("departmentCode") || "BAR",
    active: parseCheckbox(formData.get("active")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();

  const { data: supplier, error } = await supabase
    .from("suppliers")
    .insert({
      organization_id: workspace.organizationId,
      establishment_id: workspace.establishmentId,
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
      department_code: parsed.data.departmentCode,
      active: parsed.data.active,
    })
    .select("id")
    .single();

  if (error || !supplier) {
    const message = (error?.message ?? "").toLowerCase();
    if (message.includes("department_code")) {
      return {
        error:
          "Migration fournisseurs (Bar/Cuisine) non appliquée. Exécutez 20260811150000_supplier_department.sql.",
      };
    }
    return { error: mapGenericError(error) };
  }

  await writeAuditLogEntry({
    organizationId: workspace.organizationId,
    establishmentId: workspace.establishmentId,
    entityType: "supplier",
    entityId: supplier.id,
    action: parsed.data.active ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED",
    actorId: workspace.userId,
    metadata: {
      eventType: "SUPPLIER_CREATED",
      name: parsed.data.name,
      departmentCode: parsed.data.departmentCode,
      active: parsed.data.active,
    },
  });

  revalidateStockPages();
  return { success: "Fournisseur ajouté." };
}

export async function updateSupplierAction(
  _prevState: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  const workspace = await requireStockManagementMutationContext();

  const parsed = updateSupplierSchema.safeParse({
    supplierId: formData.get("supplierId"),
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
    departmentCode: formData.get("departmentCode") || "BAR",
    active: parseCheckbox(formData.get("active")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const existing = await getSupplierById(workspace, parsed.data.supplierId);

  if (!existing) {
    return { error: "Fournisseur introuvable." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("suppliers")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
      department_code: parsed.data.departmentCode,
      active: parsed.data.active,
    })
    .eq("id", parsed.data.supplierId)
    .eq("establishment_id", workspace.establishmentId);

  if (error) {
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("department_code")) {
      return {
        error:
          "Migration fournisseurs (Bar/Cuisine) non appliquée. Exécutez 20260811150000_supplier_department.sql.",
      };
    }
    return { error: mapGenericError(error) };
  }

  if (existing.active !== parsed.data.active) {
    await writeAuditLogEntry({
      organizationId: workspace.organizationId,
      establishmentId: workspace.establishmentId,
      entityType: "supplier",
      entityId: parsed.data.supplierId,
      action: parsed.data.active ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED",
      actorId: workspace.userId,
      metadata: {
        eventType: parsed.data.active ? "SUPPLIER_ACTIVATED" : "SUPPLIER_DEACTIVATED",
        name: parsed.data.name,
      },
    });
  }

  revalidateStockPages();
  return { success: "Fournisseur mis à jour." };
}

export async function toggleSupplierStatusAction(
  supplierId: string,
  active: boolean,
  confirmed: boolean,
): Promise<StockActionState> {
  const workspace = await requireStockManagementMutationContext();

  const parsed = toggleSupplierStatusSchema.safeParse({
    supplierId,
    active,
    confirmed,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Action invalide." };
  }

  if (!parsed.data.active && !parsed.data.confirmed) {
    return { error: "Veuillez confirmer la désactivation du fournisseur." };
  }

  const existing = await getSupplierById(workspace, parsed.data.supplierId);

  if (!existing) {
    return { error: "Fournisseur introuvable." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("suppliers")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.supplierId)
    .eq("establishment_id", workspace.establishmentId);

  if (error) {
    return { error: mapGenericError(error) };
  }

  await writeAuditLogEntry({
    organizationId: workspace.organizationId,
    establishmentId: workspace.establishmentId,
    entityType: "supplier",
    entityId: parsed.data.supplierId,
    action: parsed.data.active ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED",
    actorId: workspace.userId,
    metadata: {
      eventType: parsed.data.active ? "SUPPLIER_ACTIVATED" : "SUPPLIER_DEACTIVATED",
      name: existing.name,
    },
  });

  revalidateStockPages();
  return {
    success: parsed.data.active
      ? "Fournisseur réactivé."
      : "Fournisseur désactivé.",
  };
}

export async function createStockItemAction(
  _prevState: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  const workspace = await requireStockManagementMutationContext();

  const parsed = createStockItemSchema.safeParse({
    name: formData.get("name"),
    departmentCode: formData.get("departmentCode"),
    productId: formData.get("productId") || "",
    unit: formData.get("unit"),
    initialQuantity: formData.get("initialQuantity") ?? 0,
    minimumQuantity: formData.get("minimumQuantity") ?? 0,
    active: parseCheckbox(formData.get("active")),
    confirmDuplicateProductLink: parseCheckbox(formData.get("confirmDuplicateProductLink")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const permissionError = assertDepartmentPermission(
    workspace,
    parsed.data.departmentCode,
  );

  if (permissionError) {
    return { error: permissionError };
  }

  const departmentId = await getDepartmentIdByCode(workspace, parsed.data.departmentCode);

  if (!departmentId) {
    return { error: "Département introuvable." };
  }

  if (parsed.data.departmentCode === "KITCHEN" && parsed.data.productId) {
    return {
      error:
        "Le stock cuisine concerne les matières premières (riz, huile…), pas les plats vendus. Laissez le produit associé vide.",
    };
  }

  if (parsed.data.productId) {
    const productValidation = await validateProductForStockLink(
      workspace,
      parsed.data.productId,
      departmentId,
    );

    if (!productValidation.valid) {
      return { error: productValidation.error ?? "Produit vendu invalide." };
    }

    const existingLink = await findExistingStockItemForProduct(
      workspace,
      parsed.data.productId,
    );

    if (existingLink && !parsed.data.confirmDuplicateProductLink) {
      return {
        error: `Ce produit est déjà lié à l'article « ${existingLink.name} ». Cochez la confirmation pour créer un second lien.`,
      };
    }
  }

  const supabase = await createClient();

  const { data: stockItem, error } = await supabase
    .from("stock_items")
    .insert({
      organization_id: workspace.organizationId,
      establishment_id: workspace.establishmentId,
      department_id: departmentId,
      product_id: parsed.data.productId || null,
      name: parsed.data.name,
      unit: parsed.data.unit,
      current_quantity: 0,
      minimum_quantity: parsed.data.minimumQuantity,
      active: parsed.data.active,
    })
    .select("id")
    .single();

  if (error || !stockItem) {
    return { error: mapGenericError(error) };
  }

  await writeAuditLogEntry({
    organizationId: workspace.organizationId,
    establishmentId: workspace.establishmentId,
    entityType: "stock_item",
    entityId: stockItem.id,
    action: "STOCK_ENTRY_RECORDED",
    actorId: workspace.userId,
    metadata: {
      eventType: "STOCK_ITEM_CREATED",
      name: parsed.data.name,
      departmentCode: parsed.data.departmentCode,
      productId: parsed.data.productId || null,
      unit: parsed.data.unit,
      minimumQuantity: parsed.data.minimumQuantity,
      active: parsed.data.active,
    },
  });

  if (parsed.data.initialQuantity > 0) {
    const { error: entryError } = await supabase.rpc("record_stock_entry", {
      p_stock_item_id: stockItem.id,
      p_movement_type: "MANUAL_ENTRY",
      p_quantity: parsed.data.initialQuantity,
      p_purchased_quantity: parsed.data.initialQuantity,
      p_conversion_factor: 1,
      p_unit_cost: null,
      p_supplier_id: null,
      p_reference: null,
      p_reason: "Stock initial à la création de l'article",
    });

    if (entryError) {
      return {
        error:
          "Article créé, mais la quantité initiale n'a pas pu être enregistrée. Corrigez le stock manuellement.",
      };
    }
  }

  revalidateStockPages();
  return { success: "Article de stock créé." };
}

export async function startInventorySessionAction(
  _prevState: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  const workspace = await requireStockManagementMutationContext();

  const parsed = startInventorySchema.safeParse({
    departmentCode: formData.get("departmentCode"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const permissionError = assertDepartmentPermission(
    workspace,
    parsed.data.departmentCode,
  );

  if (permissionError) {
    return { error: permissionError };
  }

  const departmentId = await getDepartmentIdByCode(workspace, parsed.data.departmentCode);

  if (!departmentId) {
    return { error: "Département introuvable." };
  }

  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("inventory_sessions")
    .insert({
      organization_id: workspace.organizationId,
      establishment_id: workspace.establishmentId,
      department_id: departmentId,
      status: "DRAFT",
      started_by: workspace.userId,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    return { error: mapGenericError(sessionError) };
  }

  const { data: stockItems, error: itemsError } = await supabase
    .from("stock_items")
    .select("id, current_quantity")
    .eq("establishment_id", workspace.establishmentId)
    .eq("department_id", departmentId)
    .eq("active", true);

  if (itemsError) {
    return { error: mapGenericError(itemsError) };
  }

  if (stockItems && stockItems.length > 0) {
    const lines = stockItems.map((item) => ({
      inventory_session_id: session.id,
      stock_item_id: item.id,
      theoretical_quantity: item.current_quantity,
      counted_quantity: item.current_quantity,
      difference: 0,
    }));

    const { error: linesError } = await supabase.from("inventory_lines").insert(lines);

    if (linesError) {
      return { error: mapGenericError(linesError) };
    }
  }

  revalidateStockPages();
  return { success: "Inventaire démarré." };
}

export async function fetchStockMovementsAction(
  stockItemId: string,
): Promise<{ movements: StockMovementItem[]; error?: string }> {
  const workspace = await requireStockReadContext();

  const stockItem = await validateStockItemAccess(workspace, stockItemId);

  if (!stockItem) {
    return { movements: [], error: "Article introuvable." };
  }

  const movements = await listStockMovements(workspace, stockItemId);
  return { movements };
}
