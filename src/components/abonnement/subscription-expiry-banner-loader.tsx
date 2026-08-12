"use client";

import { useEffect, useState } from "react";

import { SubscriptionExpiryBanner } from "@/components/abonnement/subscription-expiry-banner";
import {
  getSubscriptionExpiryAlert,
  type SubscriptionExpiryAlert,
} from "@/lib/platform/access";
import { reconcileCloudSaasAccess } from "@/lib/platform/saas-authorization";
import { createClient } from "@/lib/supabase/client";

type Props = {
  organizationId: string;
  canRenew: boolean;
};

export function SubscriptionExpiryBannerLoader({
  organizationId,
  canRenew,
}: Props) {
  const [alert, setAlert] = useState<SubscriptionExpiryAlert | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const [stateResult, trialResult, subscriptionResult] = await Promise.all([
        supabase
          .from("organization_platform_states")
          .select("status")
          .eq("organization_id", organizationId)
          .maybeSingle(),
        supabase
          .from("organization_trials")
          .select("status, ends_at")
          .eq("organization_id", organizationId)
          .maybeSingle(),
        supabase
          .from("organization_subscriptions")
          .select("status, ends_at")
          .eq("organization_id", organizationId)
          .eq("is_current", true)
          .order("starts_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const reconciled = reconcileCloudSaasAccess({
        platformStatus: stateResult.data?.status,
        trial: trialResult.data
          ? {
              status: String(trialResult.data.status),
              endsAt: String(trialResult.data.ends_at),
            }
          : null,
        subscription: subscriptionResult.data
          ? {
              status: String(subscriptionResult.data.status),
              endsAt: String(subscriptionResult.data.ends_at),
            }
          : null,
      });

      setAlert(
        getSubscriptionExpiryAlert({
          status: reconciled.status,
          expiresAt: reconciled.expiresAt,
        }),
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (!alert) return null;

  return <SubscriptionExpiryBanner alert={alert} canRenew={canRenew} compact />;
}
