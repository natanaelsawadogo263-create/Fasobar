import { describe, expect, it } from "vitest";

import {
  BUSINESS_ACCESS_STATUSES,
  BLOCKED_STATUSES,
  OWNER_SUBSCRIPTION_ZONE_STATUSES,
  PLATFORM_LICENSE_STATUS_LABELS,
  PLATFORM_MACHINE_STATUS_LABELS,
  PLATFORM_REQUEST_STATUS_LABELS,
  PLATFORM_SUBSCRIPTION_STATUS_LABELS,
  addCalendarMonths,
  calculateSubscriptionWindow,
  canApproveRequest,
  canOwnerAccessSubscriptionZone,
  daysUntil,
  isBusinessAccessStatus,
  isEmployeeBlockedBySaas,
  isOpenRequestStatus,
  resolveSaasAppRedirect,
  trialEligible,
  type PlatformAccessStatus,
  type PlatformRequestStatus,
} from "@/lib/platform/access";

describe("trialEligible", () => {
  it("autorise un premier essai", () => {
    expect(trialEligible(false)).toBe(true);
  });

  it("refuse un second essai", () => {
    expect(trialEligible(true)).toBe(false);
  });
});

describe("calculateSubscriptionWindow / addCalendarMonths", () => {
  it("prolonge depuis la fin courante si le renouvellement est avant expiration", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const currentEndsAt = new Date("2026-08-15T12:00:00.000Z");
    const window = calculateSubscriptionWindow({
      now,
      durationMonths: 1,
      currentEndsAt,
    });

    expect(window.startsAt.toISOString()).toBe("2026-08-15T12:00:00.000Z");
    expect(window.endsAt.toISOString()).toBe("2026-09-15T12:00:00.000Z");
  });

  it("démarre à now si l'abonnement est déjà expiré", () => {
    const now = new Date("2026-09-01T10:00:00.000Z");
    const currentEndsAt = new Date("2026-08-01T10:00:00.000Z");
    const window = calculateSubscriptionWindow({
      now,
      durationMonths: 12,
      currentEndsAt,
    });

    expect(window.startsAt.toISOString()).toBe("2026-09-01T10:00:00.000Z");
    expect(window.endsAt.toISOString()).toBe("2027-09-01T10:00:00.000Z");
  });

  it("démarre à now s'il n'y a pas de fin courante", () => {
    const now = new Date("2026-03-10T08:00:00.000Z");
    const window = calculateSubscriptionWindow({
      now,
      durationMonths: 1,
      currentEndsAt: null,
    });

    expect(window.startsAt.toISOString()).toBe("2026-03-10T08:00:00.000Z");
    expect(window.endsAt.toISOString()).toBe("2026-04-10T08:00:00.000Z");
  });

  it("accepte currentEndsAt en ISO string", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const window = calculateSubscriptionWindow({
      now,
      durationMonths: 1,
      currentEndsAt: "2026-02-01T00:00:00.000Z",
    });

    expect(window.startsAt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(window.endsAt.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("clamp le jour en fin de mois (31 jan + 1 mois)", () => {
    const jan31 = new Date("2026-01-31T12:00:00.000Z");
    const feb = addCalendarMonths(jan31, 1);
    expect(feb.toISOString()).toBe("2026-02-28T12:00:00.000Z");
  });

  it("ajoute plusieurs mois sans dériver l'heure UTC", () => {
    const start = new Date("2026-01-15T15:30:00.000Z");
    expect(addCalendarMonths(start, 3).toISOString()).toBe(
      "2026-04-15T15:30:00.000Z",
    );
  });
});

describe("resolveSaasAppRedirect", () => {
  it("OWNER PENDING_CHOICE → /abonnement", () => {
    expect(
      resolveSaasAppRedirect({
        status: "PENDING_CHOICE",
        isOwner: true,
        isPlatformAdmin: false,
      }),
    ).toBe("/abonnement");
  });

  it("employé EXPIRED → /acces-saas-bloque", () => {
    expect(
      resolveSaasAppRedirect({
        status: "EXPIRED",
        isOwner: false,
        isPlatformAdmin: false,
      }),
    ).toBe("/acces-saas-bloque");
  });

  it("ACTIVE → null (pas de redirection)", () => {
    expect(
      resolveSaasAppRedirect({
        status: "ACTIVE",
        isOwner: true,
        isPlatformAdmin: false,
      }),
    ).toBeNull();
  });

  it("TRIAL → null", () => {
    expect(
      resolveSaasAppRedirect({
        status: "TRIAL",
        isOwner: false,
        isPlatformAdmin: false,
      }),
    ).toBeNull();
  });

  it("admin plateforme → null même si EXPIRED", () => {
    expect(
      resolveSaasAppRedirect({
        status: "EXPIRED",
        isOwner: false,
        isPlatformAdmin: true,
      }),
    ).toBeNull();
  });

  it("OWNER SUSPENDED → /acces-saas-bloque (pas /abonnement)", () => {
    expect(
      resolveSaasAppRedirect({
        status: "SUSPENDED",
        isOwner: true,
        isPlatformAdmin: false,
      }),
    ).toBe("/acces-saas-bloque");
  });

  it("OWNER PENDING_DELETION → /acces-saas-bloque", () => {
    expect(
      resolveSaasAppRedirect({
        status: "PENDING_DELETION",
        isOwner: true,
        isPlatformAdmin: false,
      }),
    ).toBe("/acces-saas-bloque");
  });

  it("OWNER TRIAL_EXPIRED → /abonnement", () => {
    expect(
      resolveSaasAppRedirect({
        status: "TRIAL_EXPIRED",
        isOwner: true,
        isPlatformAdmin: false,
      }),
    ).toBe("/abonnement");
  });

  it("OWNER EXPIRED → /abonnement", () => {
    expect(
      resolveSaasAppRedirect({
        status: "EXPIRED",
        isOwner: true,
        isPlatformAdmin: false,
      }),
    ).toBe("/abonnement");
  });

  it("employé TRIAL_EXPIRED → /acces-saas-bloque", () => {
    expect(
      resolveSaasAppRedirect({
        status: "TRIAL_EXPIRED",
        isOwner: false,
        isPlatformAdmin: false,
      }),
    ).toBe("/acces-saas-bloque");
  });

  it("employé SUSPENDED → /acces-saas-bloque", () => {
    expect(
      resolveSaasAppRedirect({
        status: "SUSPENDED",
        isOwner: false,
        isPlatformAdmin: false,
      }),
    ).toBe("/acces-saas-bloque");
  });
});

describe("canApproveRequest / isOpenRequestStatus", () => {
  it("autorise PAYMENT_SUBMITTED", () => {
    expect(canApproveRequest("PAYMENT_SUBMITTED")).toBe(true);
  });

  it("autorise UNDER_REVIEW", () => {
    expect(canApproveRequest("UNDER_REVIEW")).toBe(true);
  });

  it("autorise NEEDS_NEW_PROOF", () => {
    expect(canApproveRequest("NEEDS_NEW_PROOF")).toBe(true);
  });

  it("refuse APPROVED (idempotent)", () => {
    expect(canApproveRequest("APPROVED")).toBe(false);
  });

  it("refuse PENDING_PAYMENT", () => {
    expect(canApproveRequest("PENDING_PAYMENT")).toBe(false);
  });

  it("refuse REJECTED et CANCELLED", () => {
    expect(canApproveRequest("REJECTED")).toBe(false);
    expect(canApproveRequest("CANCELLED")).toBe(false);
  });

  it("marque les statuts ouverts", () => {
    const open: PlatformRequestStatus[] = [
      "PENDING_PAYMENT",
      "PAYMENT_SUBMITTED",
      "UNDER_REVIEW",
      "NEEDS_NEW_PROOF",
    ];
    for (const status of open) {
      expect(isOpenRequestStatus(status)).toBe(true);
    }
  });

  it("exclut les statuts terminés des demandes ouvertes", () => {
    expect(isOpenRequestStatus("APPROVED")).toBe(false);
    expect(isOpenRequestStatus("REJECTED")).toBe(false);
    expect(isOpenRequestStatus("CANCELLED")).toBe(false);
  });
});

describe("business / owner / blocked access helpers", () => {
  it("n'accorde l'accès métier qu'à TRIAL et ACTIVE", () => {
    expect(BUSINESS_ACCESS_STATUSES).toEqual(["TRIAL", "ACTIVE"]);
    expect(isBusinessAccessStatus("TRIAL")).toBe(true);
    expect(isBusinessAccessStatus("ACTIVE")).toBe(true);
    expect(isBusinessAccessStatus("EXPIRED")).toBe(false);
    expect(isBusinessAccessStatus("PENDING_CHOICE")).toBe(false);
  });

  it("bloque les employés hors TRIAL/ACTIVE", () => {
    const blocked: PlatformAccessStatus[] = [
      "PENDING_CHOICE",
      "TRIAL_EXPIRED",
      "EXPIRED",
      "SUSPENDED",
      "PENDING_DELETION",
    ];
    for (const status of blocked) {
      expect(isEmployeeBlockedBySaas(status)).toBe(true);
    }
    expect(isEmployeeBlockedBySaas("TRIAL")).toBe(false);
    expect(isEmployeeBlockedBySaas("ACTIVE")).toBe(false);
  });

  it("autorise la zone abonnement OWNER sur les statuts prévus", () => {
    expect(OWNER_SUBSCRIPTION_ZONE_STATUSES).toEqual([
      "PENDING_CHOICE",
      "TRIAL",
      "TRIAL_EXPIRED",
      "ACTIVE",
      "EXPIRED",
    ]);
    expect(canOwnerAccessSubscriptionZone("PENDING_CHOICE")).toBe(true);
    expect(canOwnerAccessSubscriptionZone("ACTIVE")).toBe(true);
    expect(canOwnerAccessSubscriptionZone("SUSPENDED")).toBe(false);
    expect(canOwnerAccessSubscriptionZone("PENDING_DELETION")).toBe(false);
  });

  it("expose les statuts bloqués SUSPENDED et PENDING_DELETION", () => {
    expect(BLOCKED_STATUSES).toEqual(["SUSPENDED", "PENDING_DELETION"]);
  });
});

describe("daysUntil et labels UI", () => {
  it("calcule les jours restants (ceil)", () => {
    const now = new Date("2026-08-06T10:00:00.000Z");
    expect(daysUntil("2026-08-08T10:00:00.000Z", now)).toBe(2);
    expect(daysUntil("2026-08-06T22:00:00.000Z", now)).toBe(1);
  });

  it("retourne un nombre négatif si la date est passée", () => {
    const now = new Date("2026-08-06T10:00:00.000Z");
    expect(daysUntil("2026-08-04T10:00:00.000Z", now)).toBe(-2);
  });

  it("exporte des libellés français pour demandes / abos / machines / licences", () => {
    expect(PLATFORM_REQUEST_STATUS_LABELS.PAYMENT_SUBMITTED).toBe(
      "Preuve envoyée",
    );
    expect(PLATFORM_SUBSCRIPTION_STATUS_LABELS.ACTIVE).toBe("Actif");
    expect(PLATFORM_MACHINE_STATUS_LABELS.REVOKED).toBe("Révoquée");
    expect(PLATFORM_LICENSE_STATUS_LABELS.GRACE_PERIOD).toBe(
      "Tolérance hors ligne",
    );
    expect(PLATFORM_MACHINE_STATUS_LABELS.BLOCKED).toBe("Bloquée");
  });
});
