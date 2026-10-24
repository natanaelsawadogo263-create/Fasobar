"use server";

import { revalidatePath } from "next/cache";

import type { DeliveryActionResult } from "@/app/(protected)/application/livraisons/actions";
import { requireDeliveryCourierMutationContext } from "@/lib/auth/workspace-context";
import { DELIVERY_PATHS } from "@/lib/delivery/constants";
import { deliveryOrderIdSchema } from "@/lib/delivery/schemas";
import { toUserFacingError } from "@/lib/errors/user-facing";
import { createClient } from "@/lib/supabase/server";

function revalidateDelivery() {
  for (const path of DELIVERY_PATHS) {
    revalidatePath(path);
  }
}

async function runCourierRpc(
  rpc: "accept_delivery_order" | "release_delivery_order" | "complete_delivery_order",
  orderId: string,
  successMessage: string,
): Promise<DeliveryActionResult> {
  await requireDeliveryCourierMutationContext();

  const parsed = deliveryOrderIdSchema.safeParse({ orderId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Commande invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { p_order_id: parsed.data.orderId });

  if (error) {
    console.error(`[${rpc}]`, error.message);
    return { error: toUserFacingError(error.message) };
  }

  revalidateDelivery();
  return { success: successMessage };
}

export async function acceptDeliveryOrderAction(orderId: string) {
  return runCourierRpc("accept_delivery_order", orderId, "Commande acceptée : elle est à vous.");
}

export async function releaseDeliveryOrderAction(orderId: string) {
  return runCourierRpc(
    "release_delivery_order",
    orderId,
    "Commande remise à disposition des autres livreurs.",
  );
}

export async function completeDeliveryOrderAction(orderId: string) {
  return runCourierRpc(
    "complete_delivery_order",
    orderId,
    "Livraison finalisée. Votre stock a été mis à jour.",
  );
}
