"use server";

import { requirePlatformAdmin } from "@/lib/platform/auth";
import { createClient } from "@/lib/supabase/server";

export async function markPlatformExpiryAlertsReadAction(
  alertIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin();

  const ids = [...new Set(alertIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_platform_expiry_alerts_read", {
    p_alert_ids: ids,
  });

  if (error) {
    if (
      error.message.toLowerCase().includes("does not exist") ||
      error.code === "PGRST202"
    ) {
      return {
        ok: false,
        error:
          "Migration alertes plateforme non appliquée. Exécutez 20260818140000_platform_expiry_alert_reads.sql.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
