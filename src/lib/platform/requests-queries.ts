import "server-only";

import {
  isPlatformRequestStatus,
  type PlatformRequestStatus,
} from "@/lib/platform/access";
import { createClient } from "@/lib/supabase/server";

export type PlatformSubscriptionRequestRow = {
  id: string;
  organizationId: string;
  organizationName: string;
  ownerUserId: string;
  ownerName: string | null;
  ownerPhone: string | null;
  planId: string;
  planCode: string;
  planName: string;
  billingPeriod: string;
  durationMonths: number;
  priceXof: number;
  expectedAmountXof: number;
  declaredAmountXof: number | null;
  referenceCode: string;
  status: PlatformRequestStatus;
  orangeMoneyNumber: string;
  payerPhone: string | null;
  payerName: string | null;
  transactionReference: string | null;
  proofStoragePath: string | null;
  reviewNote: string | null;
  rejectionReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
};

export type PlatformRequestsResult = {
  requests: PlatformSubscriptionRequestRow[];
  error: string | null;
};

function isMissingTableError(message: string): boolean {
  return /Could not find the table|schema cache|does not exist|PGRST205/i.test(
    message,
  );
}

export async function listPlatformSubscriptionRequests(): Promise<PlatformRequestsResult> {
  try {
    const supabase = await createClient();

    const [requestsResult, orgsResult, profilesResult] = await Promise.all([
      supabase
        .from("subscription_requests")
        .select(
          "id, organization_id, owner_user_id, plan_id, plan_code, plan_name, billing_period, duration_months, price_xof, expected_amount_xof, declared_amount_xof, reference_code, status, orange_money_number, payer_phone, payer_name, transaction_reference, proof_storage_path, review_note, rejection_reason, created_at, submitted_at, reviewed_at, approved_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("organizations").select("id, name"),
      supabase.from("profiles").select("id, full_name, phone"),
    ]);

    if (requestsResult.error) {
      if (isMissingTableError(requestsResult.error.message)) {
        return { requests: [], error: null };
      }
      console.error(
        "[platform] listPlatformSubscriptionRequests:",
        requestsResult.error.message,
      );
      return { requests: [], error: requestsResult.error.message };
    }

    const orgById = new Map(
      (orgsResult.data ?? []).map((o) => [o.id, o] as const),
    );
    const profileById = new Map(
      (profilesResult.data ?? []).map((p) => [p.id, p] as const),
    );

    const requests: PlatformSubscriptionRequestRow[] = (
      requestsResult.data ?? []
    ).map((row) => {
      const status = isPlatformRequestStatus(row.status)
        ? row.status
        : ("PENDING_PAYMENT" as PlatformRequestStatus);
      const org = orgById.get(row.organization_id);
      const owner = profileById.get(row.owner_user_id);

      return {
        id: row.id,
        organizationId: row.organization_id,
        organizationName: org?.name ?? "Organisation",
        ownerUserId: row.owner_user_id,
        ownerName: owner?.full_name ?? null,
        ownerPhone: owner?.phone ?? null,
        planId: row.plan_id,
        planCode: row.plan_code,
        planName: row.plan_name,
        billingPeriod: row.billing_period,
        durationMonths: row.duration_months,
        priceXof: row.price_xof,
        expectedAmountXof: row.expected_amount_xof,
        declaredAmountXof: row.declared_amount_xof,
        referenceCode: row.reference_code,
        status,
        orangeMoneyNumber: row.orange_money_number,
        payerPhone: row.payer_phone,
        payerName: row.payer_name,
        transactionReference: row.transaction_reference,
        proofStoragePath: row.proof_storage_path,
        reviewNote: row.review_note,
        rejectionReason: row.rejection_reason,
        createdAt: row.created_at,
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
        approvedAt: row.approved_at,
      };
    });

    return { requests, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inattendue.";
    console.error("[platform] listPlatformSubscriptionRequests failed:", error);
    return { requests: [], error: message };
  }
}
