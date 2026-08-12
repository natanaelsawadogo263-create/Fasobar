import "server-only";

import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { redirect } from "next/navigation";

import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import {
  readLocalSessionTokenFromCookies,
  validateLocalSession,
} from "@/lib/local-auth/session";
import { getLocalDatabase } from "@/lib/local-db/database";
import { createClient } from "@/lib/supabase/server";

function toSyntheticUser(local: {
  id: string;
  loginIdentifier: string;
  displayName: string;
  createdAt: string;
}): User {
  return {
    id: local.id,
    email: local.loginIdentifier,
    app_metadata: { provider: "fasobar-local" },
    user_metadata: { full_name: local.displayName },
    aud: "authenticated",
    created_at: local.createdAt,
    role: "authenticated",
  } as User;
}

async function getLocalSessionUser(): Promise<User | null> {
  if (!isDesktopServerRuntime()) {
    return null;
  }

  try {
    const token = await readLocalSessionTokenFromCookies();
    if (!token) {
      return null;
    }
    const db = getLocalDatabase({ skipBackup: true });
    const localUser = validateLocalSession(db, token);
    if (!localUser || localUser.status !== "ACTIVE") {
      return null;
    }
    return toSyntheticUser(localUser);
  } catch {
    return null;
  }
}

export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!error && user) {
    return user;
  }

  return getLocalSessionUser();
});

export const requireAuthenticatedUser = cache(async () => {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/connexion");
  }

  return user;
});

export async function userHasActiveOrganization(userId: string): Promise<boolean> {
  if (isDesktopServerRuntime()) {
    try {
      const { probeSupabaseReachable } = await import(
        "@/lib/desktop/cloud-reachability"
      );
      const reachable = await probeSupabaseReachable();
      if (!reachable) {
        const { findLocalUserById } = await import(
          "@/lib/local-auth/users-repository"
        );
        const db = getLocalDatabase({ skipBackup: true });
        const local = findLocalUserById(db, userId);
        return Boolean(local && local.status === "ACTIVE");
      }
    } catch {
      // fall through to cloud check
    }
  }

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
