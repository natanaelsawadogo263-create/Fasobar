"use server";

import { revalidatePath } from "next/cache";

import { requireDeliveryOrderDeskMutationContext } from "@/lib/auth/workspace-context";
import { DELIVERY_PATHS, formatDeliveryOrderNumber } from "@/lib/delivery/constants";
import {
  cancelDeliveryOrderSchema,
  createDeliveryOrderSchema,
  toRpcItems,
} from "@/lib/delivery/schemas";
import { toUserFacingError } from "@/lib/errors/user-facing";
import { createClient } from "@/lib/supabase/server";

export type DeliveryActionResult = { success?: string; error?: string };

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
}): Promise<DeliveryActionResult> {
  const workspace = await requireDeliveryOrderDeskMutationContext();

  const parsed = createDeliveryOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Commande invalide." };
  }

  const supabase = await createClient();
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

  revalidateDelivery();
  const orderNumber = Number((data as { order_number?: number } | null)?.order_number);
  return {
    success: Number.isFinite(orderNumber)
      ? `Commande ${formatDeliveryOrderNumber(orderNumber)} envoyée aux livreurs.`
      : "Commande envoyée aux livreurs.",
  };
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
