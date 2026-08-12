import "server-only";

import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { probeSupabaseReachable } from "@/lib/desktop/cloud-reachability";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import { buildWorkspaceContextFromLocalUser } from "@/lib/local-auth/workspace-local";
import { findLocalUserById } from "@/lib/local-auth/users-repository";
import { getLocalDatabase } from "@/lib/local-db/database";
import { isActivePlatformAdmin } from "@/lib/platform/auth";
import {
  getSaasRedirectForUser,
  refreshAndGetOrganizationSaasAccess,
} from "@/lib/platform/saas-gate";
import { profileRequiresPasswordChange } from "@/lib/users/queries";
import { createClient } from "@/lib/supabase/server";

export async function resolvePostLoginRedirect(userId: string): Promise<string> {
  if (isDesktopServerRuntime()) {
    const reachable = await probeSupabaseReachable();
    if (!reachable) {
      const db = getLocalDatabase({ skipBackup: true });
      const local = findLocalUserById(db, userId);
      if (!local || local.status !== "ACTIVE") {
        return "/acces-suspendu";
      }
      const context = buildWorkspaceContextFromLocalUser(local);
      const saasRedirect = await getSaasRedirectForUser(
        userId,
        context.organizationId,
        context.organizationRole === "OWNER",
      );
      if (saasRedirect) {
        return saasRedirect;
      }
      return context.homePath;
    }
  }

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

  if (await isActivePlatformAdmin()) {
    return "/platform";
  }

  const context = await getWorkspaceContext(userId);

  if (!context) {
    return "/onboarding";
  }

  await refreshAndGetOrganizationSaasAccess(context.organizationId);
  const saasRedirect = await getSaasRedirectForUser(
    userId,
    context.organizationId,
    context.organizationRole === "OWNER",
  );

  if (saasRedirect) {
    return saasRedirect;
  }

  return context.homePath;
}

export async function redirectAfterLogin(userId: string): Promise<never> {
  redirect(await resolvePostLoginRedirect(userId));
}
