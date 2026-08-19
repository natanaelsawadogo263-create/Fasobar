"use server";

import {
  requireCashRegisterOperatorContext,
  requireOrderManagementMutationContext,
  requireOrderReadContext,
} from "@/lib/auth/workspace-context";
import { usesOptionalProductLots } from "@/lib/activity/catalog";
import {
  listPackagingsForProducts,
  listSaleUnitsForProducts,
} from "@/lib/products/packaging-queries";
import { repairShopSaleUnitsIfNeeded } from "@/lib/products/lot-units";
import type { ProductUnit } from "@/lib/products/schemas";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { revalidateOrderOps } from "@/lib/ops/revalidate";
import { getOrderById } from "@/lib/orders/queries";
import {
  cancelOrderSchema,
  cartItemSchema,
  createOrderSchema,
  orderStatusSchema,
  prepareOrderSchema,
} from "@/lib/orders/schemas";
import type { OrderActionState } from "@/lib/orders/types";
import { createClient } from "@/lib/supabase/server";
import { isRetailActivity } from "@/lib/activity/profile";
import { toUserFacingError } from "@/lib/errors/user-facing";

function revalidateOrderPages(orderId?: string) {
  revalidateOrderOps(orderId);
}

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function parseItemsJson(raw: FormDataEntryValue | null) {
  if (!raw || typeof raw !== "string" || raw === "[]") {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;
  return cartItemSchema.array().parse(parsed);
}

export async function getProductSaleUnitsAction(productId: string) {
  try {
    const workspace = await requireCashRegisterOperatorContext();
    if (!productId) return [];

    const supabase = await createClient();
    const writeClient = isAdminClientConfigured() ? createAdminClient() : supabase;

    const { data: product } = await writeClient
      .from("products")
      .select("unit, selling_price, stock_unit_label")
      .eq("id", productId)
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId)
      .maybeSingle();

    if (!product) return [];

    const { formatProductUnitDisplay } = await import("@/lib/products/constants");
    const unitLabel = formatProductUnitDisplay(
      String(product.unit ?? ""),
      typeof product.stock_unit_label === "string" ? product.stock_unit_label : null,
    );
    const sellingPrice = Number(product.selling_price) || 0;

    if (usesOptionalProductLots(workspace.activityCode)) {
      const packagings = await listPackagingsForProducts(workspace, [productId]);
      await repairShopSaleUnitsIfNeeded(
        writeClient,
        workspace,
        productId,
        { unit: product.unit as ProductUnit, sellingPrice },
        packagings[productId] ?? [],
      );
    }

    const map = await listSaleUnitsForProducts(workspace, [productId], {
      [productId]: { sellingPrice, unitLabel },
    });
    return (map[productId] ?? []).map((unit) => ({
      id: unit.id,
      name: unit.name,
      price: unit.sellingPrice ?? 0,
      factor: unit.conversionFactor || 1,
      allowDecimal: Boolean(unit.allowDecimal),
    }));
  } catch {
    return [];
  }
}

function mapRpcError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
} | null): string {
  const message = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ");

  if (message.includes("Permission insuffisante")) {
    return "Permission insuffisante pour cette opération.";
  }

  if (message.includes("payée")) {
    return "Cette commande est déjà payée et ne peut plus être modifiée.";
  }

  if (message.includes("annulée")) {
    return "Cette commande est annulée.";
  }

  if (message.includes("Authentification requise")) {
    return "Session expirée. Veuillez vous reconnecter.";
  }

  if (message.includes("Stock insuffisant") || message.includes("stock insuffisant")) {
    return "Stock insuffisant pour cet article.";
  }

  if (message.includes("Produit introuvable")) {
    return "Cet article n’est plus en vente.";
  }

  if (
    message.includes("Could not find the function") ||
    message.includes("schema cache") ||
    message.includes("kitchen_prep_status") ||
    message.includes("kitchen_status") ||
    message.includes("CASE/WHEN")
  ) {
    return "Enregistrement impossible pour le moment. Réessayez.";
  }

  console.error("[saveOrderAction]", error);
  return toUserFacingError(error);
}

export async function saveOrderAction(
  _prevState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const workspace = await requireOrderManagementMutationContext();

  const targetStatusResult = orderStatusSchema.safeParse(
    formData.get("targetStatus") ?? "OPEN",
  );

  if (!targetStatusResult.success) {
    return { error: "Statut de commande invalide." };
  }

  const targetStatus = targetStatusResult.data;

  let items;
  try {
    items = parseItemsJson(formData.get("items"));
  } catch {
    return { error: "Articles de commande invalides." };
  }

  let orderId = String(formData.get("orderId") ?? "").trim();

  const headerResult = createOrderSchema.safeParse({
    tableReference: formData.get("tableReference") || undefined,
    customerReference: formData.get("customerReference") || undefined,
    orderType: formData.get("orderType") || "ON_SITE",
    notes: formData.get("notes") || undefined,
  });

  if (!headerResult.success) {
    return {
      error: headerResult.error.issues[0]?.message ?? "Informations commande invalides.",
    };
  }

  const header = headerResult.data;

  if (
    (targetStatus === "OPEN" || targetStatus === "READY_TO_PAY") &&
    items.length === 0
  ) {
    return { error: "Ajoutez au moins un article." };
  }

  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    try {
      const { saveLocalOrder } = await import("@/lib/local-domain/orders-local");
      const { getLocalActiveCashSession } = await import(
        "@/lib/local-domain/cash-sessions"
      );
      const { getLocalDatabase } = await import("@/lib/local-db/database");
      const { scheduleOutboxPush } = await import("@/lib/sync/push");
      const session = getLocalActiveCashSession(
        getLocalDatabase({ skipBackup: true }),
        workspace,
      );
      const saved = saveLocalOrder(workspace, {
        orderId: orderId || undefined,
        targetStatus,
        orderType: header.orderType,
        tableReference: header.tableReference,
        customerReference: header.customerReference,
        notes: header.notes,
        items,
        cashSessionId: session?.id ?? null,
      });
      scheduleOutboxPush();
      revalidateOrderPages(saved.orderId);
      const retail = isRetailActivity(workspace.activityCode);
      const successMessages: Record<string, string> = {
        DRAFT: retail ? "Vente enregistrée." : "Commande enregistrée en brouillon.",
        OPEN: retail ? "Vente enregistrée." : "Commande enregistrée.",
        READY_TO_PAY: retail
          ? "Vente mise de côté. Vous pouvez encaisser plus tard."
          : "Commande mise en attente d'encaissement.",
      };
      return {
        success: successMessages[targetStatus] ?? (retail ? "Vente enregistrée." : "Commande enregistrée."),
        orderId: saved.orderId,
      };
    } catch (error) {
      return {
        error: toUserFacingError(error),
      };
    }
  }

  const supabase = await createClient();

  if (orderId) {
    const existing = await getOrderById(workspace, orderId);

    if (!existing) {
      return { error: "Commande introuvable." };
    }

    if (existing.paymentStatus === "PAID") {
      return { error: "Cette commande est payée et ne peut plus être modifiée." };
    }

    if (existing.status === "CANCELLED") {
      return { error: "Cette commande est annulée." };
    }

    const { error: headerError } = await supabase.rpc("update_order_header", {
      p_order_id: orderId,
      p_table_reference: header.tableReference ?? null,
      p_customer_reference: header.customerReference ?? null,
      p_order_type: header.orderType,
      p_notes: header.notes ?? null,
    });

    if (headerError) {
      return { error: mapRpcError(headerError) };
    }
  } else {
    const { data: createdId, error: createError } = await supabase.rpc("create_order", {
      p_table_reference: header.tableReference ?? null,
      p_customer_reference: header.customerReference ?? null,
      p_order_type: header.orderType,
      p_notes: header.notes ?? null,
    });

    if (createError || !createdId) {
      return { error: mapRpcError(createError) };
    }

    orderId = createdId as string;
  }

  if (items.length > 0 || orderId) {
    const rpcItems = items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      notes: item.notes ?? null,
      unit_price: item.unitPrice ?? null,
      product_name: item.productName ?? null,
      unit_level_id: item.saleUnitId ?? null,
    }));

    const { error: saveError } = await supabase.rpc("save_order_items", {
      p_order_id: orderId,
      p_items: rpcItems,
      p_target_status: targetStatus,
    });

    if (saveError) {
      return { error: mapRpcError(saveError) };
    }
  }

  revalidateOrderPages(orderId);

  const retail = isRetailActivity(workspace.activityCode);
  const successMessages: Record<string, string> = {
    DRAFT: retail ? "Vente enregistrée." : "Commande enregistrée en brouillon.",
    OPEN: retail ? "Vente enregistrée." : "Commande enregistrée.",
    READY_TO_PAY: retail
      ? "Vente mise de côté. Vous pouvez encaisser plus tard."
      : "Commande mise en attente d'encaissement.",
  };

  return {
    success: successMessages[targetStatus] ?? (retail ? "Vente enregistrée." : "Commande enregistrée."),
    orderId,
  };
}

export async function prepareOrderForPaymentAction(
  orderId: string,
): Promise<OrderActionState> {
  const workspace = await requireOrderManagementMutationContext();

  const parsed = prepareOrderSchema.safeParse({ orderId });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Commande invalide." };
  }

  const existing = await getOrderById(workspace, parsed.data.orderId);

  if (!existing) {
    return { error: "Commande introuvable." };
  }

  if (existing.items.length === 0) {
    return { error: "Impossible de préparer une commande sans article." };
  }

  const { isDesktopServerRuntime } = await import("@/lib/desktop/runtime");
  if (isDesktopServerRuntime()) {
    try {
      const { saveLocalOrder } = await import("@/lib/local-domain/orders-local");
      const { scheduleOutboxPush } = await import("@/lib/sync/push");
      saveLocalOrder(workspace, {
        orderId: existing.id,
        targetStatus: "READY_TO_PAY",
        orderType: existing.orderType,
        tableReference: existing.tableReference,
        customerReference: existing.customerReference,
        notes: existing.notes,
        items: existing.items.map((item) => ({
          productId: item.productId,
          name: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          departmentCode: item.departmentCode,
          departmentName: item.departmentName,
          unit: "",
          notes: item.notes ?? undefined,
        })),
      });
      scheduleOutboxPush();
      revalidateOrderPages(parsed.data.orderId);
      return {
        success: "Commande prête pour l'encaissement.",
        orderId: parsed.data.orderId,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Préparation impossible.",
      };
    }
  }

  const supabase = await createClient();

  const rpcItems = existing.items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
    notes: item.notes,
    unit_price: item.unitPrice,
    product_name: item.productName,
    unit_level_id: item.saleUnitId ?? null,
  }));

  const { error } = await supabase.rpc("save_order_items", {
    p_order_id: parsed.data.orderId,
    p_items: rpcItems,
    p_target_status: "READY_TO_PAY",
  });

  if (error) {
    return { error: mapRpcError(error) };
  }

  revalidateOrderPages(parsed.data.orderId);
  return {
    success: "Commande prête pour l'encaissement.",
    orderId: parsed.data.orderId,
  };
}

export async function cancelOrderAction(
  _prevState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  await requireOrderManagementMutationContext();

  const parsed = cancelOrderSchema.safeParse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
    confirmed: parseCheckbox(formData.get("confirmed")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (!parsed.data.confirmed) {
    return { error: "Veuillez confirmer l'annulation de la commande." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return { error: mapRpcError(error) };
  }

  revalidateOrderPages(parsed.data.orderId);
  return { success: "Commande annulée." };
}

export async function getOrderAdditionAction(orderId: string): Promise<{
  error?: string;
  addition?: import("@/lib/payments/types").OrderAddition;
}> {
  const workspace = await requireOrderReadContext();
  const { getOrderAddition } = await import("@/lib/payments/queries");
  const addition = await getOrderAddition(workspace, orderId);
  if (!addition) {
    return { error: "Addition introuvable." };
  }
  return { addition };
}
