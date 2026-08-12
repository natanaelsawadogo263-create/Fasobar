"use server";

import {
  getAdminCashSessionDetail,
  type AdminCashSessionDetail,
} from "@/lib/admin/cash-sessions-queries";
import { requireAdminMutationContext } from "@/lib/auth/workspace-context";

export type AdminCashSessionDetailResult = {
  data?: AdminCashSessionDetail;
  error?: string;
};

/** Lecture seule — aucune mutation. Réservé aux rôles Admin (OWNER / ADMIN / MANAGER). */
export async function getAdminCashSessionDetailAction(
  sessionId: string,
): Promise<AdminCashSessionDetailResult> {
  const workspace = await requireAdminMutationContext();
  const detail = await getAdminCashSessionDetail(workspace, sessionId);

  if (!detail) {
    return { error: "Session de caisse introuvable." };
  }

  return { data: detail };
}
