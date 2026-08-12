"use server";

import { mapGenericError } from "@/lib/auth/errors";
import { requireKitchenMutationContext } from "@/lib/auth/workspace-context";
import type { KitchenActionState } from "@/lib/kitchen/constants";
import { updateKitchenStatusSchema } from "@/lib/kitchen/schemas";
import { revalidateOrderOps } from "@/lib/ops/revalidate";
import { createClient } from "@/lib/supabase/server";

function mapRpcError(error: { message?: string } | null): string {
  const message = error?.message ?? "";

  if (message.includes("Permission insuffisante")) {
    return "Permission insuffisante pour gérer la cuisine.";
  }

  if (message.includes("Authentification requise")) {
    return "Session expirée. Veuillez vous reconnecter.";
  }

  if (message.includes("Seules les commandes")) {
    return message;
  }

  if (message.includes("article cuisine")) {
    return "Cette commande ne contient aucun article cuisine.";
  }

  return mapGenericError(error);
}

export async function updateKitchenStatusAction(
  _prevState: KitchenActionState,
  formData: FormData,
): Promise<KitchenActionState> {
  await requireKitchenMutationContext();

  const parsed = updateKitchenStatusSchema.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("update_order_kitchen_status", {
    p_order_id: parsed.data.orderId,
    p_status: parsed.data.status,
  });

  if (error) {
    return { error: mapRpcError(error) };
  }

  revalidateOrderOps(parsed.data.orderId);

  return { success: "Statut cuisine mis à jour." };
}
