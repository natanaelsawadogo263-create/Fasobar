import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/");
  }

  return user;
}

export async function userHasActiveOrganization(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_memberships")
    .select("id, organization_id")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .limit(1);

  if (error || !data?.length) {
    return false;
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", data[0].organization_id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  return !organizationError && Boolean(organization);
}

export async function redirectIfAuthenticated() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return;
  }

  const { redirectAfterLogin } = await import("@/lib/auth/post-login");
  await redirectAfterLogin(user.id);
}
