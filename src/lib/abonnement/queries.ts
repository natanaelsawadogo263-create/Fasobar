import "server-only";

import {
  canOwnerAccessSubscriptionZone,
  isOpenRequestStatus,
  isPlatformRequestStatus,
  isPlatformSubscriptionStatus,
  trialEligible,
  type PlatformRequestStatus,
  type PlatformSubscriptionStatus,
} from "@/lib/platform/access";
import {
  refreshAndGetOrganizationSaasAccess,
  type OrganizationSaasAccess,
} from "@/lib/platform/saas-gate";
import type { PlatformAccessStatus } from "@/lib/platform/statuses";
import { createClient } from "@/lib/supabase/server";

export type AbonnementPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billingPeriod: string;
  durationMonths: number;
  priceXof: number;
  maxMachines: number;
};

export type AbonnementRequest = {
  id: string;
  referenceCode: string;
  status: PlatformRequestStatus;
  planId: string;
  planCode: string;
  planName: string;
  billingPeriod: string;
  priceXof: number;
  expectedAmountXof: number;
  orangeMoneyNumber: string;
  transactionReference: string | null;
  reviewNote: string | null;
  rejectionReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
};

export type AbonnementSubscription = {
  id: string;
  status: PlatformSubscriptionStatus;
  planName: string | null;
  billingPeriod: string;
  startsAt: string;
  endsAt: string;
  amountPaidXof: number;
};

export type AbonnementPageData = {
  organizationId: string;
  organizationName: string;
  access: OrganizationSaasAccess;
  canAccessZone: boolean;
  trialEligible: boolean;
  trialEndsAt: string | null;
  trialStatus: string | null;
  orangeMoneyNumber: string;
  paymentInstructions: string | null;
  trialEnabled: boolean;
  trialDurationDays: number;
  plans: AbonnementPlan[];
  openRequest: AbonnementRequest | null;
  requests: AbonnementRequest[];
  currentSubscription: AbonnementSubscription | null;
  error: string | null;
};

function isMissingTableError(message: string): boolean {
  return /Could not find the table|schema cache|does not exist|PGRST205/i.test(
    message,
  );
}

export async function getOwnerAbonnementData(
  organizationId: string,
  organizationName: string,
): Promise<AbonnementPageData> {
  const access = await refreshAndGetOrganizationSaasAccess(organizationId);
  const empty: AbonnementPageData = {
    organizationId,
    organizationName,
    access,
    canAccessZone: canOwnerAccessSubscriptionZone(access.status),
    trialEligible: false,
    trialEndsAt: null,
    trialStatus: null,
    orangeMoneyNumber: "+22657537299",
    paymentInstructions: null,
    trialEnabled: true,
    trialDurationDays: 7,
    plans: [],
    openRequest: null,
    requests: [],
    currentSubscription: null,
    error: null,
  };

  try {
    const supabase = await createClient();

    const [
      settingsResult,
      plansResult,
      trialResult,
      requestsResult,
      subscriptionResult,
    ] = await Promise.all([
      supabase
        .from("platform_settings")
        .select(
          "orange_money_number, payment_instructions, trial_enabled, trial_duration_days, trial_duration_months",
        )
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("subscription_plans")
        .select(
          "id, code, name, description, billing_period, duration_months, price_xof, max_machines, is_active, sort_order",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("organization_trials")
        .select("id, status, ends_at")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("subscription_requests")
        .select(
          "id, reference_code, status, plan_id, plan_code, plan_name, billing_period, price_xof, expected_amount_xof, orange_money_number, transaction_reference, review_note, rejection_reason, created_at, submitted_at, approved_at",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_subscriptions")
        .select(
          "id, status, plan_id, billing_period, starts_at, ends_at, amount_paid_xof, is_current",
        )
        .eq("organization_id", organizationId)
        .eq("is_current", true)
        .maybeSingle(),
    ]);

    const hardError =
      (settingsResult.error &&
        !isMissingTableError(settingsResult.error.message) &&
        !/trial_duration_days/i.test(settingsResult.error.message) &&
        settingsResult.error.message) ||
      (plansResult.error &&
        !isMissingTableError(plansResult.error.message) &&
        plansResult.error.message) ||
      (trialResult.error &&
        !isMissingTableError(trialResult.error.message) &&
        trialResult.error.message) ||
      (requestsResult.error &&
        !isMissingTableError(requestsResult.error.message) &&
        requestsResult.error.message) ||
      (subscriptionResult.error &&
        !isMissingTableError(subscriptionResult.error.message) &&
        subscriptionResult.error.message) ||
      null;

    if (hardError) {
      console.error("[abonnement] getOwnerAbonnementData:", hardError);
      return { ...empty, error: hardError };
    }

    let settings = settingsResult.data;
    if (
      settingsResult.error &&
      /trial_duration_days/i.test(settingsResult.error.message)
    ) {
      const fallback = await supabase
        .from("platform_settings")
        .select(
          "orange_money_number, payment_instructions, trial_enabled, trial_duration_months",
        )
        .eq("id", 1)
        .maybeSingle();
      settings = fallback.data
        ? { ...fallback.data, trial_duration_days: 7 }
        : null;
    }
    const plans: AbonnementPlan[] = (plansResult.data ?? []).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      billingPeriod: p.billing_period,
      durationMonths: p.duration_months,
      priceXof: p.price_xof,
      maxMachines: p.max_machines,
    }));

    const requests: AbonnementRequest[] = (requestsResult.data ?? []).map((r) => ({
      id: r.id,
      referenceCode: r.reference_code,
      status: isPlatformRequestStatus(r.status)
        ? r.status
        : ("PENDING_PAYMENT" as PlatformRequestStatus),
      planId: r.plan_id,
      planCode: r.plan_code,
      planName: r.plan_name,
      billingPeriod: r.billing_period,
      priceXof: r.price_xof,
      expectedAmountXof: r.expected_amount_xof,
      orangeMoneyNumber: r.orange_money_number,
      transactionReference: r.transaction_reference,
      reviewNote: r.review_note,
      rejectionReason: r.rejection_reason,
      createdAt: r.created_at,
      submittedAt: r.submitted_at,
      approvedAt: r.approved_at,
    }));

    const openRequest =
      requests.find((r) => isOpenRequestStatus(r.status)) ?? null;

    let currentSubscription: AbonnementSubscription | null = null;
    const sub = subscriptionResult.data;
    if (sub) {
      let planName: string | null = null;
      const planMatch = plans.find((p) => p.id === sub.plan_id);
      if (planMatch) {
        planName = planMatch.name;
      } else {
        const { data: planRow } = await supabase
          .from("subscription_plans")
          .select("name")
          .eq("id", sub.plan_id)
          .maybeSingle();
        planName = planRow?.name ?? null;
      }

      currentSubscription = {
        id: sub.id,
        status: isPlatformSubscriptionStatus(sub.status)
          ? sub.status
          : ("EXPIRED" as PlatformSubscriptionStatus),
        planName,
        billingPeriod: sub.billing_period,
        startsAt: sub.starts_at,
        endsAt: sub.ends_at,
        amountPaidXof: sub.amount_paid_xof,
      };
    }

    const hasTrial = Boolean(trialResult.data);
    const status = access.status as PlatformAccessStatus;

    return {
      organizationId,
      organizationName,
      access,
      canAccessZone: canOwnerAccessSubscriptionZone(status),
      trialEligible:
        trialEligible(hasTrial) &&
        status === "PENDING_CHOICE" &&
        Boolean(settings?.trial_enabled ?? true),
      trialEndsAt: trialResult.data?.ends_at ?? null,
      trialStatus: trialResult.data?.status ?? null,
      orangeMoneyNumber:
        settings?.orange_money_number ?? empty.orangeMoneyNumber,
      paymentInstructions: settings?.payment_instructions ?? null,
      trialEnabled: settings?.trial_enabled ?? true,
      trialDurationDays:
        typeof settings?.trial_duration_days === "number" &&
        settings.trial_duration_days > 0
          ? settings.trial_duration_days
          : 7,
      plans,
      openRequest,
      requests,
      currentSubscription,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inattendue.";
    console.error("[abonnement] getOwnerAbonnementData failed:", error);
    return { ...empty, error: message };
  }
}
