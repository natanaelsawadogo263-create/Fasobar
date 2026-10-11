import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export type RateLimitRule = {
  /** Préfixe lisible, ex. `login:id`. */
  scope: string;
  /** Valeur limitée (identifiant, IP…) — hachée avant stockage. */
  key: string;
  max: number;
  windowSeconds: number;
};

/** IP cliente telle que transmise par Vercel / le proxy (premier hop). */
export async function getClientIp(): Promise<string> {
  try {
    const headerStore = await headers();
    const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || headerStore.get("x-real-ip")?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function bucketFor(rule: RateLimitRule): string {
  const digest = createHash("sha256")
    .update(rule.key.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
  return `${rule.scope}:${digest}`;
}

async function callRateLimit(
  rule: RateLimitRule,
  record: boolean,
): Promise<boolean> {
  if (!rule.key.trim() || !isAdminClientConfigured()) {
    return false;
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("auth_rate_limit_check", {
      p_bucket: bucketFor(rule),
      p_max: rule.max,
      p_window_seconds: rule.windowSeconds,
      p_record: record,
    });
    if (error) {
      // Migration absente / base indisponible : ne pas bloquer la connexion.
      console.warn("[rate-limit] check failed:", error.message);
      return false;
    }
    return data === true;
  } catch (error) {
    console.warn("[rate-limit] check failed:", error);
    return false;
  }
}

/** true si au moins une règle a atteint sa limite (sans enregistrer). */
export async function isRateLimited(rules: RateLimitRule[]): Promise<boolean> {
  const results = await Promise.all(rules.map((rule) => callRateLimit(rule, false)));
  return results.some(Boolean);
}

/** Enregistre une tentative (ex. échec de connexion) pour chaque règle. */
export async function recordRateLimitHit(rules: RateLimitRule[]): Promise<void> {
  await Promise.all(rules.map((rule) => callRateLimit(rule, true)));
}

export const RATE_LIMIT_MESSAGE =
  "Trop de tentatives. Veuillez réessayer dans quelques minutes.";
