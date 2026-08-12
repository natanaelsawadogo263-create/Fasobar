"use server";

import { redirect } from "next/navigation";

import { mapGenericError } from "@/lib/auth/errors";
import { requireBarManagerMutationContext } from "@/lib/auth/workspace-context";
import type { BarActionState } from "@/lib/bar/constants";
import {
  closeBarSessionSchema,
  openBarSessionSchema,
  updateBarStatusSchema,
} from "@/lib/bar/schemas";
import { getOwnOpenBarSession } from "@/lib/bar/session-queries";
import type { BarSessionActionState } from "@/lib/bar/session-types";
import { revalidateBarSessionOps, revalidateOrderOps } from "@/lib/ops/revalidate";
import { createClient } from "@/lib/supabase/server";

function mapRpcError(error: { message?: string } | null): string {
  const message = error?.message ?? "";

  if (message.includes("Permission insuffisante")) {
    return "Permission insuffisante pour gérer le bar.";
  }
  if (message.includes("Authentification requise")) {
    return "Session expirée. Veuillez vous reconnecter.";
  }
  if (message.includes("article bar") || message.includes("préparation bar")) {
    return message;
  }
  if (message.includes("Seules les commandes")) {
    return message;
  }
  if (message.includes("service bar")) {
    return message;
  }
  if (message.includes("Ouvrez votre service")) {
    return message;
  }
  if (message.includes("prendre la relève") || message.includes("déjà ouvert")) {
    return message;
  }

  return mapGenericError(error);
}

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

export async function updateBarStatusAction(
  _prevState: BarActionState,
  formData: FormData,
): Promise<BarActionState> {
  await requireBarManagerMutationContext();

  const parsed = updateBarStatusSchema.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_order_bar_status", {
    p_order_id: parsed.data.orderId,
    p_status: parsed.data.status,
  });

  if (error) {
    return { error: mapRpcError(error) };
  }

  revalidateOrderOps(parsed.data.orderId);
  revalidateBarSessionOps();
  return { success: "Statut boisson mis à jour." };
}

export async function openBarSessionAction(
  _prevState: BarSessionActionState,
  formData: FormData,
): Promise<BarSessionActionState> {
  await requireBarManagerMutationContext();

  const parsed = openBarSessionSchema.safeParse({
    openingNote: formData.get("openingNote") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const { data: sessionId, error } = await supabase.rpc("open_bar_session", {
    p_opening_note: parsed.data.openingNote ?? null,
  });

  if (error || !sessionId) {
    return { error: mapRpcError(error) };
  }

  revalidateBarSessionOps();
  return { success: "Service bar ouvert.", sessionId: sessionId as string };
}

export async function closeBarSessionAction(
  _prevState: BarSessionActionState,
  formData: FormData,
): Promise<BarSessionActionState> {
  const workspace = await requireBarManagerMutationContext();

  const parsed = closeBarSessionSchema.safeParse({
    sessionId: formData.get("sessionId"),
    closingNote: formData.get("closingNote") || undefined,
    confirmed: parseCheckbox(formData.get("confirmed")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  if (!parsed.data.confirmed) {
    return {
      error:
        "Cochez « Je confirme avoir vérifié ce bilan » avant de fermer la session.",
    };
  }

  const ownSession = await getOwnOpenBarSession(workspace);
  if (!ownSession || ownSession.id !== parsed.data.sessionId) {
    return { error: "Vous ne pouvez clôturer que votre propre service bar." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_bar_session", {
    p_session_id: parsed.data.sessionId,
    p_closing_note: parsed.data.closingNote ?? null,
  });

  if (error) {
    return { error: mapRpcError(error) };
  }

  revalidateBarSessionOps();
  await supabase.auth.signOut();
  redirect("/");
}
