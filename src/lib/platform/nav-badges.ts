import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PlatformNavBadges } from "@/lib/platform/navigation";
import { countPendingEstablishmentOpeningRequests } from "@/lib/platform/opening-requests-queries";

const PENDING_SUBSCRIPTION_STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_NEW_PROOF",
] as const;

export async function getPlatformNavBadges(): Promise<PlatformNavBadges> {
  const supabase = await createClient();

  const [openingRequests, subscriptionResult] = await Promise.all([
    countPendingEstablishmentOpeningRequests(),
    supabase
      .from("subscription_requests")
      .select("id", { count: "exact", head: true })
      .in("status", [...PENDING_SUBSCRIPTION_STATUSES]),
  ]);

  return {
    openingRequests,
    subscriptionRequests: subscriptionResult.error ? 0 : (subscriptionResult.count ?? 0),
  };
}
