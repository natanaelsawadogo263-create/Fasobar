"use server";

import { revalidatePath } from "next/cache";

import { ensureImplicitAdminCashSession } from "@/app/(protected)/application/caisse/payment-actions";
import { requireDeliveryOrderDeskMutationContext } from "@/lib/auth/workspace-context";
import { DELIVERY_PATHS, formatDeliveryOrderNumber } from "@/lib/delivery/constants";
import {
  cancelDeliveryOrderSchema,
  cashDeliveryOrderSchema,
  createDeliveryOrderSchema,
  toRpcItems,
} from "@/lib/delivery/schemas";
import { toUserFacingError } from "@/lib/errors/user-facing";
import { createClient } from "@/lib/supabase/server";

export type DeliveryActionResult = { success?: string; error?: string };

/** Pages qui affichent ventes et fond de caisse, à rafraîchir après un encaissement. */
const CASH_IN_PATHS = [
  "/application/caisse/session",
  "/application/commandes-ouvertes",
  "/application/ventes",
  "/application/tableau-de-bord",
] as const;

function revalidateDelivery() {
  for (const path of DELIVERY_PATHS) {
    revalidatePath(path);
  }
}

export async function createDeliveryOrderAction(input: {
  items: Array<{ productId: string; quantity: number }>;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  note?: string;
  /** Commande caisse enregistrée (« En attente ») transformée en livraison : elle est clôturée. */
  replacesOrderId?: string;
}): Promise<DeliveryActionResult> {
  const workspace = await requireDeliveryOrderDeskMutationContext();

  const parsed = createDeliveryOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Commande invalide." };
  }

  const supabase = await createClient();

  // Formats en gros : la base doit connaître l'unité vendue, sinon le carton partirait au prix unitaire.
  if (parsed.data.items.some((item) => item.saleUnitId)) {
    const { error: columnError } = await supabase
      .from("delivery_order_items")
      .select("stock_quantity")
      .limit(1);
    if (columnError) {
      console.error("[createDeliveryOrderAction] formats en gros:", columnError.message);
      return {
        error: "La livraison en gros n’est pas encore activée sur le serveur. Livrez à l’unité pour le moment.",
      };
    }
  }

  const { data, error } = await supabase.rpc("create_delivery_order", {
    p_establishment_id: workspace.establishmentId,
    p_items: toRpcItems(parsed.data.items),
    p_customer_name: parsed.data.customerName ?? null,
    p_customer_phone: parsed.data.customerPhone ?? null,
    p_delivery_address: parsed.data.deliveryAddress ?? null,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    console.error("[createDeliveryOrderAction]", error.message);
    return { error: toUserFacingError(error.message) };
  }

  const orderNumber = Number((data as { order_number?: number } | null)?.order_number);

  // Sans ça, la commande d'origine resterait ouverte et compterait en double.
  const replacesOrderId = input.replacesOrderId?.trim();
  if (replacesOrderId && /^[0-9a-f-]{36}$/i.test(replacesOrderId)) {
    const { error: cancelError } = await supabase.rpc("cancel_order", {
      p_order_id: replacesOrderId,
      p_reason: Number.isFinite(orderNumber)
        ? `Envoyée en livraison ${formatDeliveryOrderNumber(orderNumber)}`
        : "Envoyée en livraison",
    });
    if (cancelError) {
      console.warn("[createDeliveryOrderAction] commande d'origine:", cancelError.message);
    }
    revalidatePath("/application/commandes-ouvertes");
    revalidatePath("/application/caisse");
  }

  revalidateDelivery();
  return {
    success: Number.isFinite(orderNumber)
      ? `Commande ${formatDeliveryOrderNumber(orderNumber)} envoyée aux livreurs.`
      : "Commande envoyée aux livreurs.",
  };
}

/** La caisse encaisse une livraison livrée : la vente est enregistrée dans sa session. */
export async function cashDeliveryOrderAction(input: {
  orderId: string;
  method: string;
  amountReceived?: number;
  transactionReference?: string;
}): Promise<DeliveryActionResult> {
  await requireDeliveryOrderDeskMutationContext();

  const parsed = cashDeliveryOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Encaissement invalide." };
  }

  // L'admin n'ouvre pas de session à la main : elle est ouverte pour lui si besoin.
  const ensureError = await ensureImplicitAdminCashSession();
  if (ensureError?.error) {
    return { error: ensureError.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cash_delivery_order", {
    p_order_id: parsed.data.orderId,
    p_method: parsed.data.method,
    p_amount_received: parsed.data.amountReceived ?? null,
    p_transaction_reference: parsed.data.transactionReference ?? null,
    p_provider: null,
  });

  if (error) {
    console.error("[cashDeliveryOrderAction]", error.message);
    return { error: toUserFacingError(error.message) };
  }

  revalidateDelivery();
  for (const path of CASH_IN_PATHS) {
    revalidatePath(path);
  }
  return { success: "Commande encaissée : la vente est enregistrée." };
}

export async function cancelDeliveryOrderAction(input: {
  orderId: string;
  reason?: string;
}): Promise<DeliveryActionResult> {
  await requireDeliveryOrderDeskMutationContext();

  const parsed = cancelDeliveryOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Commande invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_delivery_order", {
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason ?? null,
  });

  if (error) {
    console.error("[cancelDeliveryOrderAction]", error.message);
    return { error: toUserFacingError(error.message) };
  }

  revalidateDelivery();
  return { success: "Commande annulée." };
}
