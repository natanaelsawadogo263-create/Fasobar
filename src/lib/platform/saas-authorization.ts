import {
  isBusinessAccessStatus,
  type PlatformAccessStatus,
} from "@/lib/platform/access";
import { isPlatformAccessStatus } from "@/lib/platform/statuses";

export type SaasTrialEvidence = {
  status: string;
  endsAt: string;
};

export type SaasSubscriptionEvidence = {
  status: string;
  endsAt: string;
};

export type CloudSaasEvidence = {
  platformStatus: string | null | undefined;
  trial: SaasTrialEvidence | null;
  subscription: SaasSubscriptionEvidence | null;
  now?: Date;
};

export type ReconciledSaasAccess = {
  status: PlatformAccessStatus;
  expiresAt: string | null;
};

export type LocalSaasAuthorization = {
  organizationId: string;
  status: PlatformAccessStatus;
  expiresAt: string | null;
  recordedAt: string;
};

function parseStatus(raw: string | null | undefined): PlatformAccessStatus | null {
  if (!raw) return null;
  return isPlatformAccessStatus(raw) ? raw : null;
}

function isNotExpired(endsAt: string, now: Date): boolean {
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return false;
  return end >= now;
}

/**
 * Normalize a raw cloud status without inventing PENDING_CHOICE for known
 * business statuses (fixes TRIAL → PENDING_CHOICE mapping bugs).
 */
export function normalizePlatformAccessStatus(
  raw: string | null | undefined,
): PlatformAccessStatus | null {
  return parseStatus(raw);
}

/**
 * Reconcile platform_states + trial/subscription evidence into the effective
 * SaaS status. A still-valid ACTIVE trial always yields TRIAL (never PENDING_CHOICE).
 */
export function reconcileCloudSaasAccess(
  evidence: CloudSaasEvidence,
): ReconciledSaasAccess {
  const now = evidence.now ?? new Date();
  const platform = parseStatus(evidence.platformStatus);
  const trial = evidence.trial;
  const subscription = evidence.subscription;

  if (platform === "SUSPENDED" || platform === "PENDING_DELETION") {
    return { status: platform, expiresAt: null };
  }

  const subscriptionActive =
    Boolean(subscription) &&
    subscription!.status === "ACTIVE" &&
    isNotExpired(subscription!.endsAt, now);

  const trialActive =
    Boolean(trial) &&
    trial!.status === "ACTIVE" &&
    isNotExpired(trial!.endsAt, now);

  if (subscriptionActive) {
    return { status: "ACTIVE", expiresAt: subscription!.endsAt };
  }

  if (trialActive) {
    return { status: "TRIAL", expiresAt: trial!.endsAt };
  }

  if (trial) {
    const trialEnded =
      trial.status === "EXPIRED" ||
      trial.status === "CANCELLED" ||
      !isNotExpired(trial.endsAt, now);
    if (trialEnded && trial.status !== "CONVERTED") {
      if (subscription) {
        return { status: "EXPIRED", expiresAt: subscription.endsAt };
      }
      return { status: "TRIAL_EXPIRED", expiresAt: trial.endsAt };
    }
    if (trial.status === "CONVERTED" && subscription) {
      return {
        status: subscriptionActive ? "ACTIVE" : "EXPIRED",
        expiresAt: subscription.endsAt,
      };
    }
  }

  if (subscription) {
    return { status: "EXPIRED", expiresAt: subscription.endsAt };
  }

  // Preserve explicit cloud TRIAL/ACTIVE even if child rows are momentarily missing.
  if (platform === "TRIAL") {
    const expiresAt = trial?.endsAt ?? null;
    if (expiresAt && !isNotExpired(expiresAt, now)) {
      return { status: "TRIAL_EXPIRED", expiresAt };
    }
    return { status: "TRIAL", expiresAt };
  }

  if (platform === "ACTIVE") {
    return { status: "ACTIVE", expiresAt: null };
  }

  if (platform) {
    return {
      status: platform,
      expiresAt: trial?.endsAt ?? null,
    };
  }

  return { status: "PENDING_CHOICE", expiresAt: null };
}

/** True when status grants business access and optional expiry is still in the future. */
export function isSaasAuthorizationGranted(
  status: PlatformAccessStatus,
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!isBusinessAccessStatus(status)) {
    return false;
  }
  if (expiresAt == null || expiresAt === "") {
    return true;
  }
  return isNotExpired(expiresAt, now);
}

/**
 * Offline decision from the last locally stored SaaS authorization.
 * A still-valid TRIAL continues to grant access until expiresAt.
 */
export function evaluateOfflineSaasAuthorization(
  local: Pick<LocalSaasAuthorization, "status" | "expiresAt"> | null,
  now: Date = new Date(),
): { allowed: boolean; status: PlatformAccessStatus } {
  if (!local) {
    return { status: "PENDING_CHOICE", allowed: false };
  }

  if (local.status === "TRIAL" || local.status === "ACTIVE") {
    const allowed = isSaasAuthorizationGranted(
      local.status,
      local.expiresAt,
      now,
    );
    if (!allowed && local.status === "TRIAL") {
      return { status: "TRIAL_EXPIRED", allowed: false };
    }
    if (!allowed && local.status === "ACTIVE") {
      return { status: "EXPIRED", allowed: false };
    }
    return { status: local.status, allowed: true };
  }

  return { status: local.status, allowed: false };
}
