import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import {
  requireAuthenticatedUser,
  userHasActiveOrganization,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Appelle la RPC SECURITY DEFINER `is_active_platform_admin`.
 * Avec JWT utilisateur, la RPC ignore tout UUID et teste uniquement auth.uid().
 * Ne dépend jamais du workspace restaurant (pas de requireWorkspaceContext).
 */
export const isActivePlatformAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_active_platform_admin");

  if (error) {
    console.error("[platform] is_active_platform_admin failed:", error.message);
    return false;
  }

  return data === true;
});

export async function requirePlatformAdmin() {
  const user = await requireAuthenticatedUser();

  if (!(await isActivePlatformAdmin())) {
    if (await userHasActiveOrganization(user.id)) {
      redirect("/application");
    }
    redirect("/acces-refuse");
  }

  return user;
}
