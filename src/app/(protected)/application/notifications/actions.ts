"use server";

import { requireAdminContext } from "@/lib/auth/workspace-context";
import { createClient } from "@/lib/supabase/server";

export async function markAdminNotificationsReadAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const workspace = await requireAdminContext();
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_admin_notifications_read", {
    p_establishment_id: workspace.establishmentId,
  });

  if (error) {
    if (
      error.message.toLowerCase().includes("does not exist") ||
      error.code === "PGRST202"
    ) {
      return {
        ok: false,
        error:
          "Migration notifications non appliquée. Exécutez 20260811160000_admin_notifications.sql.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
