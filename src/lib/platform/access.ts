import type { PlatformAccessStatus } from "@/lib/platform/statuses";

export type { PlatformAccessStatus };

export type PlatformRequestStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_SUBMITTED"
  | "UNDER_REVIEW"
  | "NEEDS_NEW_PROOF"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type PlatformSubscriptionStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "CANCELLED";

export type PlatformMachineStatus =
  | "PENDING"
  | "ACTIVE"
  | "REVOKED"
  | "BLOCKED";

export type PlatformLicenseStatus =
  | "ACTIVE"
  | "GRACE_PERIOD"
  | "EXPIRED"
  | "REVOKED";

export const BUSINESS_ACCESS_STATUSES: readonly PlatformAccessStatus[] = [
  "TRIAL",
  "ACTIVE",
] as const;

export const OWNER_SUBSCRIPTION_ZONE_STATUSES: readonly PlatformAccessStatus[] = [
  "PENDING_CHOICE",
  "TRIAL",
  "TRIAL_EXPIRED",
  "ACTIVE",
  "EXPIRED",
] as const;

export const BLOCKED_STATUSES: readonly PlatformAccessStatus[] = [
  "SUSPENDED",
  "PENDING_DELETION",
] as const;

export const PLATFORM_REQUEST_STATUSES: PlatformRequestStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_NEW_PROOF",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

export const PLATFORM_SUBSCRIPTION_STATUSES: PlatformSubscriptionStatus[] = [
  "ACTIVE",
  "EXPIRED",
  "SUSPENDED",
  "CANCELLED",
];

export const PLATFORM_MACHINE_STATUSES: PlatformMachineStatus[] = [
  "PENDING",
  "ACTIVE",
  "REVOKED",
  "BLOCKED",
];

export const PLATFORM_LICENSE_STATUSES: PlatformLicenseStatus[] = [
  "ACTIVE",
  "GRACE_PERIOD",
  "EXPIRED",
  "REVOKED",
];

export const PLATFORM_REQUEST_STATUS_LABELS: Record<PlatformRequestStatus, string> = {
  PENDING_PAYMENT: "Paiement en attente",
  PAYMENT_SUBMITTED: "Preuve envoyée",
  UNDER_REVIEW: "En examen",
  NEEDS_NEW_PROOF: "Nouvelle preuve requise",
  APPROVED: "Approuvée",
  REJECTED: "Refusée",
  CANCELLED: "Annulée",
};

export const PLATFORM_SUBSCRIPTION_STATUS_LABELS: Record<
  PlatformSubscriptionStatus,
  string
> = {
  ACTIVE: "Actif",
  EXPIRED: "Expiré",
  SUSPENDED: "Suspendu",
  CANCELLED: "Résilié",
};

export const PLATFORM_MACHINE_STATUS_LABELS: Record<PlatformMachineStatus, string> = {
  PENDING: "En attente",
  ACTIVE: "Active",
  REVOKED: "Révoquée",
  BLOCKED: "Bloquée",
};

export const PLATFORM_LICENSE_STATUS_LABELS: Record<PlatformLicenseStatus, string> = {
  ACTIVE: "Active",
  GRACE_PERIOD: "Tolérance hors ligne",
  EXPIRED: "Expirée",
  REVOKED: "Révoquée",
};

const APPROVABLE_REQUEST_STATUSES: readonly PlatformRequestStatus[] = [
  "PAYMENT_SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_NEW_PROOF",
] as const;

const OPEN_REQUEST_STATUSES: readonly PlatformRequestStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_NEW_PROOF",
] as const;

const OWNER_ABONNEMENT_REDIRECT_STATUSES: readonly PlatformAccessStatus[] = [
  "PENDING_CHOICE",
  "TRIAL_EXPIRED",
  "EXPIRED",
] as const;

export function isBusinessAccessStatus(
  status: PlatformAccessStatus,
): boolean {
  return (BUSINESS_ACCESS_STATUSES as readonly string[]).includes(status);
}

export function canOwnerAccessSubscriptionZone(
  status: PlatformAccessStatus,
): boolean {
  return (OWNER_SUBSCRIPTION_ZONE_STATUSES as readonly string[]).includes(status);
}

/** True lorsque le statut n'autorise pas l'exploitation métier (hors TRIAL/ACTIVE). */
export function isEmployeeBlockedBySaas(status: PlatformAccessStatus): boolean {
  return !isBusinessAccessStatus(status);
}

export type SaasAppRedirectInput = {
  status: PlatformAccessStatus;
  isOwner: boolean;
  isPlatformAdmin: boolean;
};

/**
 * Redirection SaaS pour l'app métier.
 * - null : accès OK (admin plateforme ou TRIAL/ACTIVE)
 * - /abonnement : OWNER en choix / essai expiré / abo expiré
 * - /acces-saas-bloque : employés bloqués, ou OWNER suspendu / suppression
 */
export function resolveSaasAppRedirect({
  status,
  isOwner,
  isPlatformAdmin,
}: SaasAppRedirectInput): string | null {
  if (isPlatformAdmin || isBusinessAccessStatus(status)) {
    return null;
  }

  if (isOwner) {
    if ((BLOCKED_STATUSES as readonly string[]).includes(status)) {
      return "/acces-saas-bloque";
    }
    if ((OWNER_ABONNEMENT_REDIRECT_STATUSES as readonly string[]).includes(status)) {
      return "/abonnement";
    }
  }

  return "/acces-saas-bloque";
}

export type SubscriptionWindowInput = {
  now: Date;
  durationMonths: number;
  currentEndsAt?: Date | string | null;
};

export type SubscriptionWindow = {
  startsAt: Date;
  endsAt: Date;
};

/** Ajoute des mois calendaires en préservant le jour (clamp fin de mois). */
export function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months);

  // Overflow (ex. 31 jan → mars) : revenir au dernier jour du mois cible.
  if (result.getUTCDate() < day) {
    result.setUTCDate(0);
  }

  return result;
}

/**
 * Fenêtre d'abonnement :
 * - renouvellement avant échéance → démarre à currentEndsAt
 * - sinon → démarre à now
 */
export function calculateSubscriptionWindow({
  now,
  durationMonths,
  currentEndsAt,
}: SubscriptionWindowInput): SubscriptionWindow {
  const currentEnd =
    currentEndsAt == null
      ? null
      : currentEndsAt instanceof Date
        ? currentEndsAt
        : new Date(currentEndsAt);

  const startsAt =
    currentEnd != null && !Number.isNaN(currentEnd.getTime()) && currentEnd > now
      ? new Date(currentEnd.getTime())
      : new Date(now.getTime());

  return {
    startsAt,
    endsAt: addCalendarMonths(startsAt, durationMonths),
  };
}

/** Nombre de jours restants jusqu'à une date ISO (ceil). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = new Date(iso);
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** Un seul essai gratuit par organisation. */
export function trialEligible(hasExistingTrial: boolean): boolean {
  return !hasExistingTrial;
}

export function canApproveRequest(status: PlatformRequestStatus): boolean {
  return (APPROVABLE_REQUEST_STATUSES as readonly string[]).includes(status);
}

export function isOpenRequestStatus(status: PlatformRequestStatus): boolean {
  return (OPEN_REQUEST_STATUSES as readonly string[]).includes(status);
}

export function isPlatformRequestStatus(
  value: string,
): value is PlatformRequestStatus {
  return PLATFORM_REQUEST_STATUSES.includes(value as PlatformRequestStatus);
}

export function isPlatformSubscriptionStatus(
  value: string,
): value is PlatformSubscriptionStatus {
  return PLATFORM_SUBSCRIPTION_STATUSES.includes(
    value as PlatformSubscriptionStatus,
  );
}

export function isPlatformMachineStatus(
  value: string,
): value is PlatformMachineStatus {
  return PLATFORM_MACHINE_STATUSES.includes(value as PlatformMachineStatus);
}

export function isPlatformLicenseStatus(
  value: string,
): value is PlatformLicenseStatus {
  return PLATFORM_LICENSE_STATUSES.includes(value as PlatformLicenseStatus);
}
