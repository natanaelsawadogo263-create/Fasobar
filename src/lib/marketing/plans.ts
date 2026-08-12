import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  FALLBACK_PUBLIC_PLANS,
  type PublicPlan,
} from "@/lib/marketing/plan-constants";

export type { PublicPlan };
export { FALLBACK_PUBLIC_PLANS };

export async function getPublicSubscriptionPlans(): Promise<PublicPlan[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("subscription_plans")
      .select(
        "code, name, description, billing_period, duration_months, price_xof, is_active, sort_order",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !data?.length) {
      return FALLBACK_PUBLIC_PLANS;
    }

    return data.map((row) => ({
      code: String(row.code),
      name: String(row.name),
      description: row.description ? String(row.description) : null,
      billingPeriod: String(row.billing_period),
      durationMonths: Number(row.duration_months),
      priceXof: Number(row.price_xof),
    }));
  } catch {
    return FALLBACK_PUBLIC_PLANS;
  }
}
