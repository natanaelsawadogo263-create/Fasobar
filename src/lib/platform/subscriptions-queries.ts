import "server-only";

import {
  isPlatformSubscriptionStatus,
  type PlatformSubscriptionStatus,
} from "@/lib/platform/access";
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

    const [subsResult, plansResult, orgsResult] = await Promise.all([
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

    const subscriptions: PlatformSubscriptionRow[] = (
      subsResult.data ?? []
    ).map((row) => {
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
