"use server";

import { revalidatePath } from "next/cache";

import type { DeliveryActionResult } from "@/app/(protected)/application/livraisons/actions";
import { requireDeliveryManagerMutationContext } from "@/lib/auth/workspace-context";
import { DELIVERY_PATHS } from "@/lib/delivery/constants";
import { courierStockOperationSchema, toRpcItems } from "@/lib/delivery/schemas";
import { toUserFacingError } from "@/lib/errors/user-facing";
import { createClient } from "@/lib/supabase/server";

type CourierStockInput = {
  courierId: string;
  items: Array<{ productId: string; quantity: number }>;
  note?: string;
};

async function runStockOperation(
  rpc: "allocate_courier_stock" | "return_courier_stock",
  input: CourierStockInput,
  successMessage: string,
): Promise<DeliveryActionResult> {
  const workspace = await requireDeliveryManagerMutationContext();

  const parsed = courierStockOperationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, {
    p_establishment_id: workspace.establishmentId,
    p_courier_id: parsed.data.courierId,
    p_items: toRpcItems(parsed.data.items),
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    console.error(`[${rpc}]`, error.message);
    return { error: toUserFacingError(error.message) };
  }

  for (const path of DELIVERY_PATHS) {
    revalidatePath(path);
  }
  revalidatePath(`/application/livreurs/${parsed.data.courierId}`);
  revalidatePath("/application/stock");
  return { success: successMessage };
}

export async function allocateCourierStockAction(input: CourierStockInput) {
  return runStockOperation("allocate_courier_stock", input, "Stock remis au livreur.");
}

export async function returnCourierStockAction(input: CourierStockInput) {
  return runStockOperation(
    "return_courier_stock",
    input,
    "Retour enregistré : le stock principal a été mis à jour.",
  );
}
