import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLOUD_PROBE_CACHE_MS,
  CLOUD_PROBE_TIMEOUT_MS,
  probeSupabaseReachable,
  resetCloudReachabilityCacheForTests,
  resolveSupabaseProbeUrl,
  type ProbeFetch,
} from "@/lib/desktop/cloud-reachability";
import {
  markCatalogPulled,
  resolveSyncUiStatus,
} from "@/lib/sync/status";
import {
  closeLocalDatabase,
  getLocalDatabase,
  getLocalDbHealth,
  resetLocalDatabaseSingletonForTests,
} from "@/lib/local-db/database";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SUPABASE = "https://example.supabase.co";

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fasobar-reach-"));
}

function mockResponse(status = 200): Response {
  return new Response("ok", { status });
}

afterEach(() => {
  resetCloudReachabilityCacheForTests();
  resetLocalDatabaseSingletonForTests();
  vi.useRealTimers();
});

describe("probeSupabaseReachable", () => {
  it("successful probe => reachable", async () => {
    const fetchImpl: ProbeFetch = vi.fn(async () => mockResponse(401));
    expect(
      await probeSupabaseReachable({
        fetchImpl,
        supabaseUrl: SUPABASE,
        requireDesktopRuntime: false,
        bypassCache: true,
      }),
    ).toBe(true);
  });

  it("DNS failure => offline", async () => {
    const fetchImpl: ProbeFetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(
      await probeSupabaseReachable({
        fetchImpl,
        supabaseUrl: SUPABASE,
        requireDesktopRuntime: false,
        bypassCache: true,
      }),
    ).toBe(false);
  });

  it("timeout => offline", async () => {
    const fetchImpl: ProbeFetch = vi.fn((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    expect(
      await probeSupabaseReachable({
        fetchImpl,
        supabaseUrl: SUPABASE,
        requireDesktopRuntime: false,
        bypassCache: true,
        timeoutMs: 20,
      }),
    ).toBe(false);
  });

  it("cache then recovery without restart", async () => {
    let fail = true;
    const fetchImpl: ProbeFetch = vi.fn(async () => {
      if (fail) throw new TypeError("down");
      return mockResponse(200);
    });
    expect(
      await probeSupabaseReachable({
        fetchImpl,
        supabaseUrl: SUPABASE,
        requireDesktopRuntime: false,
        bypassCache: true,
        nowMs: 1000,
      }),
    ).toBe(false);
    fail = false;
    expect(
      await probeSupabaseReachable({
        fetchImpl,
        supabaseUrl: SUPABASE,
        requireDesktopRuntime: false,
        nowMs: 1000 + CLOUD_PROBE_CACHE_MS + 1,
      }),
    ).toBe(true);
  });

  it("timeout/cache constants in range", () => {
    expect(CLOUD_PROBE_TIMEOUT_MS).toBeGreaterThanOrEqual(2000);
    expect(CLOUD_PROBE_TIMEOUT_MS).toBeLessThanOrEqual(4000);
    expect(CLOUD_PROBE_CACHE_MS).toBeGreaterThanOrEqual(5000);
    expect(CLOUD_PROBE_CACHE_MS).toBeLessThanOrEqual(60_000);
    expect(resolveSupabaseProbeUrl(SUPABASE)).toContain("/auth/v1/health");
  });
});

describe("syncStatus vs live probe", () => {
  it("stale ONLINE_SYNCED + probe offline => OFFLINE", () => {
    const root = tempRoot();
    const db = getLocalDatabase({
      userDataRoot: root,
      skipBackup: true,
      force: true,
    });
    markCatalogPulled(db, new Date().toISOString());
    expect(resolveSyncUiStatus(db)).toBe("ONLINE_SYNCED");
    expect(resolveSyncUiStatus(db, { cloudReachable: false })).toBe("OFFLINE");
    closeLocalDatabase();
  });

  it("SQLite OK + cloud offline => health ok", () => {
    const root = tempRoot();
    getLocalDatabase({ userDataRoot: root, skipBackup: true, force: true });
    const health = getLocalDbHealth();
    expect(health.ok).toBe(true);
    expect(health.schemaVersion).toBe(4);
    closeLocalDatabase();
  });
});
