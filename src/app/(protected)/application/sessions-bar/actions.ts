"use server";

import { requireAdminContext } from "@/lib/auth/workspace-context";
import {
  getAdminBarSessionDetail,
  type AdminBarSessionDetail,
} from "@/lib/admin/bar-sessions-queries";

export async function getAdminBarSessionDetailAction(
  sessionId: string,
): Promise<{ data?: AdminBarSessionDetail; error?: string }> {
  const workspace = await requireAdminContext();

  if (!sessionId) {
    return { error: "Session invalide." };
  }

  const detail = await getAdminBarSessionDetail(workspace, sessionId);
  if (!detail) {
    return { error: "Session bar introuvable." };
  }

  return { data: detail };
}
