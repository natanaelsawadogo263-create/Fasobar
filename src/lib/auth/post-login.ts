import "server-only";

import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { profileRequiresPasswordChange } from "@/lib/users/queries";
import { createClient } from "@/lib/supabase/server";

export async function resolvePostLoginRedirect(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.status === "INACTIVE") {
    return "/acces-suspendu";
  }

  if (await profileRequiresPasswordChange(userId)) {
    return "/premiere-connexion";
  }

  const context = await getWorkspaceContext(userId);

  if (!context) {
    return "/onboarding";
  }

  return context.homePath;
}

export async function redirectAfterLogin(userId: string): Promise<never> {
  redirect(await resolvePostLoginRedirect(userId));
}
