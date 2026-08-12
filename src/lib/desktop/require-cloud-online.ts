import "server-only";

import { redirect } from "next/navigation";

import { probeSupabaseReachable } from "@/lib/desktop/cloud-reachability";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";

/**
 * Soft-fail helper for cloud-only server actions (never throws / never crashes).
 */
export async function getCloudOfflineActionError(): Promise<string | null> {
  if (!isDesktopServerRuntime()) {
    return null;
  }
  const reachable = await probeSupabaseReachable();
  if (reachable) {
    return null;
  }
  return "Mode hors connexion — cette opération nécessite Internet.";
}

/**
 * Internet-first gate for cloud-only admin features.
 * Offline desktop → soft redirect (never crash).
 */
export async function requireCloudOnlineForDesktop(
  returnTo = "/application/caisse",
): Promise<void> {
  if (!isDesktopServerRuntime()) {
    return;
  }

  const reachable = await probeSupabaseReachable();
  if (reachable) {
    return;
  }

  const params = new URLSearchParams({
    offline: "1",
    from: returnTo,
  });
  redirect(`/application/mode-hors-connexion?${params.toString()}`);
}
