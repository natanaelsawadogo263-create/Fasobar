import "server-only";

import { isDesktopServerRuntime } from "@/lib/desktop/runtime";

/** Max wait for a single Supabase reachability probe. */
export const CLOUD_PROBE_TIMEOUT_MS = 3000;

/** Reuse the last probe result for this window (health is polled often). */
export const CLOUD_PROBE_CACHE_MS = 30000;

export type ProbeFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

type CacheEntry = {
  atMs: number;
  reachable: boolean;
};

let cache: CacheEntry | null = null;

/** Test helper — clear short-lived probe cache. */
export function resetCloudReachabilityCacheForTests(): void {
  cache = null;
}

/**
 * URL used for a lightweight reachability check.
 * Any HTTP response (incl. 401/404) means the host is reachable.
 */
export function resolveSupabaseProbeUrl(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  const base = supabaseUrl?.trim();
  if (!base) {
    return null;
  }
  try {
    const origin = new URL(base).origin;
    // Auth health is public and cheap; 401/404 still prove DNS + TCP + TLS.
    return `${origin}/auth/v1/health`;
  } catch {
    return null;
  }
}

export type ProbeSupabaseOptions = {
  fetchImpl?: ProbeFetch;
  timeoutMs?: number;
  cacheMs?: number;
  bypassCache?: boolean;
  nowMs?: number;
  supabaseUrl?: string;
  /** When false, skip the desktop-server runtime guard (unit tests). */
  requireDesktopRuntime?: boolean;
};

/**
 * Live probe: can this desktop-server host currently reach Supabase?
 * DNS / timeout / connection errors => false. Any HTTP status => true.
 */
export async function probeSupabaseReachable(
  options: ProbeSupabaseOptions = {},
): Promise<boolean> {
  const requireDesktop = options.requireDesktopRuntime !== false;
  if (requireDesktop && !isDesktopServerRuntime()) {
    return false;
  }

  const nowMs = options.nowMs ?? Date.now();
  const cacheMs = options.cacheMs ?? CLOUD_PROBE_CACHE_MS;

  if (
    !options.bypassCache &&
    cache &&
    nowMs - cache.atMs < cacheMs
  ) {
    return cache.reachable;
  }

  const url = resolveSupabaseProbeUrl(options.supabaseUrl);
  if (!url) {
    cache = { atMs: nowMs, reachable: false };
    return false;
  }

  const timeoutMs = options.timeoutMs ?? CLOUD_PROBE_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    // Consume body lightly so the connection can close; status is irrelevant.
    try {
      await response.arrayBuffer();
    } catch {
      // ignore body read errors — headers already prove reachability
    }
    cache = { atMs: nowMs, reachable: true };
    return true;
  } catch {
    cache = { atMs: nowMs, reachable: false };
    return false;
  } finally {
    clearTimeout(timer);
  }
}
