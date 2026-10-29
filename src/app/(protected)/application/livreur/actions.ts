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

/**
 * Finalise la livraison et déclare le coût de la course : s'il est > 0,
 * il deviendra une dépense « Transport » à l'encaissement par la caisse.
 */
export async function completeDeliveryOrderAction(
  orderId: string,
  deliveryFee: number,
): Promise<DeliveryActionResult> {
  await requireDeliveryCourierMutationContext();

  const parsed = deliveryOrderIdSchema.safeParse({ orderId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Commande invalide." };
  }
  if (!Number.isInteger(deliveryFee) || deliveryFee < 0 || deliveryFee > 1_000_000) {
    return { error: "Indiquez le coût de la course en F CFA (0 si gratuite)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_delivery_order_with_fee", {
    p_order_id: parsed.data.orderId,
    p_delivery_fee: deliveryFee,
  });

  if (error) {
    // Migration des frais non appliquée : on finalise quand même la livraison.
    if (/could not find|does not exist/i.test(error.message ?? "")) {
      const fallback = await runCourierRpc(
        "complete_delivery_order",
        parsed.data.orderId,
        "Livraison finalisée. Remettez l’argent à la caisse pour l’encaissement.",
      );
      if (fallback.error || deliveryFee === 0) return fallback;
      return {
        success:
          "Livraison finalisée. Les frais de course n’ont pas pu être notés en dépense : signalez-les à la caisse.",
      };
    }
    console.error("[complete_delivery_order_with_fee]", error.message);
    return { error: toUserFacingError(error.message) };
  }

  revalidateDelivery();
  revalidatePath("/application/depenses");
  return {
    success:
      deliveryFee > 0
        ? "Livraison finalisée, frais de course notés. Remettez l’argent à la caisse."
        : "Livraison finalisée. Remettez l’argent à la caisse pour l’encaissement.",
  };
}
