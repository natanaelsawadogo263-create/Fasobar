"use client";

import { useEffect } from "react";

import { useToast } from "@/components/ui/toast";
import {
  getSubscriptionExpiryAlert,
  getSubscriptionExpiryAlertCopy,
} from "@/lib/platform/access";
import { reconcileCloudSaasAccess } from "@/lib/platform/saas-authorization";
import { createClient } from "@/lib/supabase/client";

type Props = {
  organizationId: string;
  canRenew: boolean;
};

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function storageKey(organizationId: string): string {
  return `fasobar.expiryToast.${organizationId}`;
}

function alreadyShownToday(organizationId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(organizationId)) === todayKey();
  } catch {
    return false;
  }
}

function markShownToday(organizationId: string) {
  try {
    window.localStorage.setItem(storageKey(organizationId), todayKey());
  } catch {
    // ignore
  }
}

/**
 * À la connexion admin : toast éphémère si essai / abo bientôt expiré.
 * Fréquence : une fois par jour et par organisation (localStorage).
 */
export function SubscriptionExpiryBannerLoader({
  organizationId,
  canRenew,
}: Props) {
  const toast = useToast();

  useEffect(() => {
    if (!organizationId) return;
    if (alreadyShownToday(organizationId)) return;

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

      const alert = getSubscriptionExpiryAlert({
        status: reconciled.status,
        expiresAt: reconciled.expiresAt,
      });

      if (!alert) return;
      if (alreadyShownToday(organizationId)) return;

      const copy = getSubscriptionExpiryAlertCopy(alert);
      const suffix = canRenew
        ? " Renouvelez depuis Mon abonnement."
        : " Contactez le propriétaire pour renouveler.";
      const tone = alert.urgency === "critical" ? "error" : "warning";

      markShownToday(organizationId);
      toast.show(`${copy.title}.${suffix}`, tone);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, canRenew, toast]);

  return null;
}
