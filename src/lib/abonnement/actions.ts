"use server";

import { revalidatePath } from "next/cache";

import {
  mapRpcFailure,
  okResult,
  type PlatformActionResult,
} from "@/lib/platform/action-result";
import { canOwnerAccessSubscriptionZone } from "@/lib/platform/access";
import { refreshAndGetOrganizationSaasAccess } from "@/lib/platform/saas-gate";
import { uploadSubscriptionPaymentProof } from "@/lib/platform/proof-storage";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { getCloudOfflineActionError } from "@/lib/desktop/require-cloud-online";
import { createClient } from "@/lib/supabase/server";

async function requireOwnerSubscriptionContext() {
  const offlineError = await getCloudOfflineActionError();
  if (offlineError) {
    return {
      ok: false as const,
      error: offlineError,
    };
  }

  const user = await requireAuthenticatedUser();
  const workspace = await getWorkspaceContext(user.id);

  if (!workspace) {
    return {
      ok: false as const,
      error: "Aucune organisation active.",
    };
  }

  if (workspace.organizationRole !== "OWNER") {
    return {
      ok: false as const,
      error: "Seul le propriétaire peut gérer l’abonnement.",
    };
  }

  const access = await refreshAndGetOrganizationSaasAccess(
    workspace.organizationId,
  );

  if (!canOwnerAccessSubscriptionZone(access.status)) {
    return {
      ok: false as const,
      error: "Zone abonnement indisponible pour cet état SaaS.",
    };
  }

  return { ok: true as const, workspace, access };
}

export async function startOrganizationTrialAction(): Promise<PlatformActionResult> {
  const ctx = await requireOwnerSubscriptionContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_organization_trial", {
    p_organization_id: ctx.workspace.organizationId,
  });

  if (error) {
    console.error("[abonnement] start_organization_trial failed:", error.message);
    return mapRpcFailure(error.message);
  }

  revalidatePath("/abonnement");
  revalidatePath("/application/mon-abonnement");
  revalidatePath("/application");
  return okResult();
}

export async function createSubscriptionRequestAction(input: {
  planId: string;
}): Promise<PlatformActionResult> {
  if (!input.planId.trim()) {
    return { ok: false, error: "Formule obligatoire." };
  }

  const ctx = await requireOwnerSubscriptionContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_subscription_request", {
    p_organization_id: ctx.workspace.organizationId,
    p_plan_id: input.planId.trim(),
  });

  if (error) {
    console.error(
      "[abonnement] submit_subscription_request failed:",
      error.message,
    );
    return mapRpcFailure(error.message);
  }

  revalidatePath("/abonnement");
  revalidatePath("/application/mon-abonnement");
  return okResult();
}

export async function changeSubscriptionRequestPlanAction(input: {
  requestId: string;
  planId: string;
}): Promise<PlatformActionResult> {
  if (!input.requestId.trim() || !input.planId.trim()) {
    return { ok: false, error: "Demande ou formule manquante." };
  }

  const ctx = await requireOwnerSubscriptionContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_open_subscription_request_plan", {
    p_request_id: input.requestId.trim(),
    p_plan_id: input.planId.trim(),
  });

  if (error) {
    console.error(
      "[abonnement] change_open_subscription_request_plan failed:",
      error.message,
    );
    return mapRpcFailure(error.message);
  }

  revalidatePath("/abonnement");
  revalidatePath("/application/mon-abonnement");
  return okResult();
}

export async function uploadSubscriptionProofAction(
  formData: FormData,
): Promise<PlatformActionResult> {
  const requestId = String(formData.get("requestId") ?? "").trim();
  const transactionReference = String(
    formData.get("transactionReference") ?? "",
  ).trim();
  const payerPhone = String(formData.get("payerPhone") ?? "").trim();
  const payerName = String(formData.get("payerName") ?? "").trim();
  const declaredRaw = String(formData.get("declaredAmountXof") ?? "").trim();
  const file = formData.get("file");

  if (!requestId) {
    return { ok: false, error: "Demande introuvable." };
  }
  if (!payerPhone) {
    return { ok: false, error: "Numéro payeur obligatoire." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Capture d’écran obligatoire." };
  }

  const declaredAmountXof = declaredRaw ? Number(declaredRaw) : null;

  const ctx = await requireOwnerSubscriptionContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const upload = await uploadSubscriptionPaymentProof({
    organizationId: ctx.workspace.organizationId,
    requestId,
    file,
  });

  if (!upload.ok) {
    return upload;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_subscription_payment_proof", {
    p_request_id: requestId,
    p_storage_path: upload.storagePath,
    // Sans n° Orange Money : une référence unique par demande (pas le joker "PREUVE").
    p_tx_ref: transactionReference || `PREUVE-${requestId}`,
    p_payer_phone: payerPhone,
    p_payer_name: payerName || null,
    p_declared_amount:
      declaredAmountXof != null && Number.isFinite(declaredAmountXof)
        ? Math.floor(declaredAmountXof)
        : null,
  });

  if (error) {
    console.error(
      "[abonnement] submit_subscription_payment_proof failed:",
      error.message,
    );
    return mapRpcFailure(error.message);
  }

  revalidatePath("/abonnement");
  revalidatePath("/application/mon-abonnement");
  return okResult();
}
