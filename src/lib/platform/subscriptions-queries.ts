import "server-only";

import {
  isPlatformSubscriptionStatus,
  type PlatformSubscriptionStatus,
} from "@/lib/platform/access";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PlatformSubscriptionRow = {
  id: string;
  organizationId: string;
  organizationName: string;
  planId: string;
  planCode: string | null;
  planName: string | null;
  status: PlatformSubscriptionStatus;
  billingPeriod: string;
  durationMonths: number;
  amountPaidXof: number;
  startsAt: string;
  endsAt: string;
  isCurrent: boolean;
  cancelledAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
};

export type PlatformPlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billingPeriod: string;
  durationMonths: number;
  priceXof: number;
  maxMachines: number;
  isActive: boolean;
  sortOrder: number;
};

export type PlatformSubscriptionsResult = {
  subscriptions: PlatformSubscriptionRow[];
  plans: PlatformPlanRow[];
  error: string | null;
};

function isMissingTableError(message: string): boolean {
  return /Could not find the table|schema cache|does not exist|PGRST205/i.test(
    message,
  );
}

export async function listPlatformSubscriptions(): Promise<PlatformSubscriptionsResult> {
  try {
    const supabase = await createClient();

    const [subsResult, plansResult, orgsResult, statesResult] =
      await Promise.all([
        supabase
          .from("organization_subscriptions")
          .select(
            "id, organization_id, plan_id, status, billing_period, duration_months, amount_paid_xof, starts_at, ends_at, is_current, cancelled_at, suspended_at, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("subscription_plans")
          .select(
            "id, code, name, description, billing_period, duration_months, price_xof, max_machines, is_active, sort_order",
          )
          .order("sort_order", { ascending: true }),
        supabase.from("organizations").select("id, name"),
        supabase
          .from("organization_platform_states")
          .select("organization_id, status"),
      ]);

    if (subsResult.error && !isMissingTableError(subsResult.error.message)) {
      console.error(
        "[platform] listPlatformSubscriptions:",
        subsResult.error.message,
      );
      return {
        subscriptions: [],
        plans: [],
        error: subsResult.error.message,
      };
    }

    const orgById = new Map(
      (orgsResult.data ?? []).map((o) => [o.id, o] as const),
    );
    const planById = new Map(
      (plansResult.data ?? []).map((p) => [p.id, p] as const),
    );
    const stateStatusByOrgId = new Map(
      (statesResult.data ?? []).map((s) => [s.organization_id, s.status] as const),
    );

    const plans: PlatformPlanRow[] = (plansResult.data ?? []).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      billingPeriod: p.billing_period,
      durationMonths: p.duration_months,
      priceXof: p.price_xof,
      maxMachines: p.max_machines,
      isActive: p.is_active,
      sortOrder: p.sort_order,
    }));

    // Une organisation en suppression programmée (PENDING_DELETION) reste en
    // base pendant le délai de récupération, mais ne doit plus apparaître
    // dans la liste des abonnements que voit le super admin au quotidien —
    // même logique que la vue « Tous » de /platform/clients.
    const subscriptions: PlatformSubscriptionRow[] = (
      subsResult.data ?? []
    )
      .filter(
        (row) => stateStatusByOrgId.get(row.organization_id) !== "PENDING_DELETION",
      )
      .map((row) => {
      const plan = planById.get(row.plan_id);
      const status = isPlatformSubscriptionStatus(row.status)
        ? row.status
        : ("EXPIRED" as PlatformSubscriptionStatus);

      return {
        id: row.id,
        organizationId: row.organization_id,
        organizationName: orgById.get(row.organization_id)?.name ?? "Organisation",
        planId: row.plan_id,
        planCode: plan?.code ?? null,
        planName: plan?.name ?? null,
        status,
        billingPeriod: row.billing_period,
        durationMonths: row.duration_months,
        amountPaidXof: row.amount_paid_xof,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        isCurrent: row.is_current,
        cancelledAt: row.cancelled_at,
        suspendedAt: row.suspended_at,
        createdAt: row.created_at,
      };
    });

    return { subscriptions, plans, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inattendue.";
    console.error("[platform] listPlatformSubscriptions failed:", error);
    return { subscriptions: [], plans: [], error: message };
  }
}

export type PlatformSubscriptionReceipt = {
  id: string;
  referenceCode: string;
  organizationId: string;
  organizationName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  planName: string | null;
  planCode: string | null;
  billingPeriod: string;
  durationMonths: number;
  status: PlatformSubscriptionStatus;
  startsAt: string;
  endsAt: string;
  amountPaidXof: number;
  createdAt: string;
  orangeMoneyNumber: string | null;
  transactionReference: string | null;
  payerName: string | null;
  payerPhone: string | null;
};

/**
 * Reçu détaillé d'un abonnement précis — requête dédiée (une ligne), pas un
 * filtre sur listPlatformSubscriptions() : évite de recharger toute la liste
 * pour afficher/imprimer un seul reçu, et va chercher en plus l'e-mail du
 * propriétaire (auth.users, via le client admin) et les infos de paiement
 * de la demande d'abonnement à l'origine (subscription_requests).
 */
export async function getPlatformSubscriptionReceipt(
  subscriptionId: string,
): Promise<PlatformSubscriptionReceipt | null> {
  try {
    const supabase = await createClient();

    const { data: sub, error: subError } = await supabase
      .from("organization_subscriptions")
      .select(
        "id, organization_id, plan_id, status, billing_period, duration_months, amount_paid_xof, starts_at, ends_at, created_at",
      )
      .eq("id", subscriptionId)
      .maybeSingle();

    if (subError) {
      console.error("[platform] getPlatformSubscriptionReceipt:", subError.message);
      return null;
    }
    if (!sub) return null;

    const [orgResult, planResult, ownerMembershipResult, requestResult] =
      await Promise.all([
        supabase
          .from("organizations")
          .select("id, name")
          .eq("id", sub.organization_id)
          .maybeSingle(),
        supabase
          .from("subscription_plans")
          .select("code, name")
          .eq("id", sub.plan_id)
          .maybeSingle(),
        supabase
          .from("organization_memberships")
          .select("user_id")
          .eq("organization_id", sub.organization_id)
          .eq("role", "OWNER")
          .eq("status", "ACTIVE")
          .maybeSingle(),
        supabase
          .from("subscription_requests")
          .select(
            "reference_code, transaction_reference, payer_name, payer_phone, orange_money_number",
          )
          .eq("resulting_subscription_id", sub.id)
          .maybeSingle(),
      ]);

    const ownerUserId = ownerMembershipResult.data?.user_id ?? null;
    let ownerName: string | null = null;
    let ownerPhone: string | null = null;
    let ownerEmail: string | null = null;

    if (ownerUserId) {
      const profileResult = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", ownerUserId)
        .maybeSingle();
      ownerName = profileResult.data?.full_name ?? null;
      ownerPhone = profileResult.data?.phone ?? null;

      if (isAdminClientConfigured()) {
        try {
          const admin = createAdminClient();
          const { data } = await admin.auth.admin.getUserById(ownerUserId);
          ownerEmail = data.user?.email?.toLowerCase() ?? null;
        } catch (error) {
          console.error(
            "[platform] getPlatformSubscriptionReceipt email fetch failed:",
            error,
          );
        }
      }
    }

    const status = isPlatformSubscriptionStatus(sub.status)
      ? sub.status
      : ("EXPIRED" as PlatformSubscriptionStatus);

    return {
      id: sub.id,
      referenceCode:
        requestResult.data?.reference_code ??
        `REC-${sub.id.slice(0, 8).toUpperCase()}`,
      organizationId: sub.organization_id,
      organizationName: orgResult.data?.name ?? "Organisation",
      ownerName,
      ownerEmail,
      ownerPhone,
      planName: planResult.data?.name ?? null,
      planCode: planResult.data?.code ?? null,
      billingPeriod: sub.billing_period,
      durationMonths: sub.duration_months,
      status,
      startsAt: sub.starts_at,
      endsAt: sub.ends_at,
      amountPaidXof: sub.amount_paid_xof,
      createdAt: sub.created_at,
      orangeMoneyNumber: requestResult.data?.orange_money_number ?? null,
      transactionReference: requestResult.data?.transaction_reference ?? null,
      payerName: requestResult.data?.payer_name ?? null,
      payerPhone: requestResult.data?.payer_phone ?? null,
    };
  } catch (error) {
    console.error("[platform] getPlatformSubscriptionReceipt failed:", error);
    return null;
  }
}
