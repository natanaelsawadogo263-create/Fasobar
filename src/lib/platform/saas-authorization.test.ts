import { describe, expect, it } from "vitest";

import {
  evaluateOfflineSaasAuthorization,
  isSaasAuthorizationGranted,
  normalizePlatformAccessStatus,
  reconcileCloudSaasAccess,
} from "@/lib/platform/saas-authorization";

const NOW = new Date("2026-08-10T12:00:00.000Z");
const FUTURE = "2026-09-10T12:00:00.000Z";
const PAST = "2026-07-10T12:00:00.000Z";

describe("normalizePlatformAccessStatus", () => {
  it("conserve TRIAL (ne le transforme pas en PENDING_CHOICE)", () => {
    expect(normalizePlatformAccessStatus("TRIAL")).toBe("TRIAL");
  });

  it("retourne null pour une valeur inconnue (pas de faux PENDING_CHOICE ici)", () => {
    expect(normalizePlatformAccessStatus("UNKNOWN")).toBeNull();
  });
});

describe("reconcileCloudSaasAccess", () => {
  it("TRIAL valide = accès (status TRIAL)", () => {
    const result = reconcileCloudSaasAccess({
      platformStatus: "TRIAL",
      trial: { status: "ACTIVE", endsAt: FUTURE },
      subscription: null,
      now: NOW,
    });
    expect(result.status).toBe("TRIAL");
    expect(result.expiresAt).toBe(FUTURE);
    expect(isSaasAuthorizationGranted(result.status, result.expiresAt, NOW)).toBe(
      true,
    );
  });

  it("ne transforme pas un essai cloud valide en PENDING_CHOICE", () => {
    const result = reconcileCloudSaasAccess({
      // Bug historique : platform_states pouvait rester PENDING_CHOICE
      // alors que organization_trials est encore ACTIVE + valide.
      platformStatus: "PENDING_CHOICE",
      trial: { status: "ACTIVE", endsAt: FUTURE },
      subscription: null,
      now: NOW,
    });
    expect(result.status).toBe("TRIAL");
    expect(isSaasAuthorizationGranted(result.status, result.expiresAt, NOW)).toBe(
      true,
    );
  });

  it("TRIAL expiré = blocage", () => {
    const result = reconcileCloudSaasAccess({
      platformStatus: "TRIAL",
      trial: { status: "ACTIVE", endsAt: PAST },
      subscription: null,
      now: NOW,
    });
    expect(result.status).toBe("TRIAL_EXPIRED");
    expect(isSaasAuthorizationGranted(result.status, result.expiresAt, NOW)).toBe(
      false,
    );
  });

  it("ACTIVE = accès", () => {
    const result = reconcileCloudSaasAccess({
      platformStatus: "ACTIVE",
      trial: null,
      subscription: { status: "ACTIVE", endsAt: FUTURE },
      now: NOW,
    });
    expect(result.status).toBe("ACTIVE");
    expect(isSaasAuthorizationGranted(result.status, result.expiresAt, NOW)).toBe(
      true,
    );
  });
});

describe("evaluateOfflineSaasAuthorization", () => {
  it("offline + dernière autorisation TRIAL encore valide = accès", () => {
    const decision = evaluateOfflineSaasAuthorization(
      {
        status: "TRIAL",
        expiresAt: FUTURE,
      },
      NOW,
    );
    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe("TRIAL");
  });

  it("offline + TRIAL local expiré = blocage", () => {
    const decision = evaluateOfflineSaasAuthorization(
      {
        status: "TRIAL",
        expiresAt: PAST,
      },
      NOW,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("TRIAL_EXPIRED");
  });
});
