"use server";

import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

type ActionResult = { ok: boolean; error?: string };

/**
 * Enregistre (ou met à jour) l'abonnement push de l'utilisateur courant.
 * Volontairement disponible pour n'importe quel utilisateur authentifié
 * (Admin, Responsable Bar, Super Admin) — la portée (quel établissement,
 * quels événements) se décide au moment de l'envoi, pas ici.
 *
 * Écrit via le service role plutôt que le client RLS : un même appareil
 * partagé (ex. tablette bar) peut se réabonner sous un utilisateur différent
 * d'une session à l'autre — l'upsert doit pouvoir réattribuer la ligne,
 * ce que la policy RLS "update own" ne permettrait pas sur la ligne d'un
 * autre utilisateur. L'identité est déjà vérifiée via la session cookie
 * juste avant.
 */
export async function savePushSubscriptionAction(
  input: PushSubscriptionInput,
): Promise<ActionResult> {
  const endpoint = input.endpoint?.trim();
  const p256dh = input.keys?.p256dh?.trim();
  const auth = input.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: "Abonnement push invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "Authentification requise." };
  }

  if (!isAdminClientConfigured()) {
    return { ok: false, error: "Configuration serveur incomplète." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function removePushSubscriptionAction(
  endpoint: string,
): Promise<ActionResult> {
  const trimmed = endpoint?.trim();
  if (!trimmed) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Authentification requise." };
  if (!isAdminClientConfigured()) {
    return { ok: false, error: "Configuration serveur incomplète." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", trimmed)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
