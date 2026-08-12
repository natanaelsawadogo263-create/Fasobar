import { describe, expect, it } from "vitest";

import { resolveDesktopConnectivityLabel } from "@/lib/desktop/connectivity-label";

describe("resolveDesktopConnectivityLabel", () => {
  it("Internet OFF → Mode hors connexion", () => {
    expect(resolveDesktopConnectivityLabel("ONLINE_SYNCED", false)).toBe(
      "Mode hors connexion",
    );
    expect(resolveDesktopConnectivityLabel("OFFLINE", true)).toBe(
      "Mode hors connexion",
    );
  });

  it("Internet ON + synced → En ligne", () => {
    expect(resolveDesktopConnectivityLabel("ONLINE_SYNCED", true)).toBe(
      "En ligne",
    );
  });

  it("Internet ON + pending → Synchronisation", () => {
    expect(resolveDesktopConnectivityLabel("ONLINE_PENDING", true)).toBe(
      "Synchronisation",
    );
    expect(resolveDesktopConnectivityLabel("SYNCING", true)).toBe(
      "Synchronisation",
    );
  });
});
