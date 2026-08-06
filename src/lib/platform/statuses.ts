export type PlatformAccessStatus =
  | "PENDING_CHOICE"
  | "TRIAL"
  | "TRIAL_EXPIRED"
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "PENDING_DELETION";

export const PLATFORM_ACCESS_STATUSES: PlatformAccessStatus[] = [
  "PENDING_CHOICE",
  "TRIAL",
  "TRIAL_EXPIRED",
  "ACTIVE",
  "EXPIRED",
  "SUSPENDED",
  "PENDING_DELETION",
];

export const PLATFORM_ACCESS_STATUS_LABELS: Record<PlatformAccessStatus, string> = {
  PENDING_CHOICE: "Choix en attente",
  TRIAL: "Essai",
  TRIAL_EXPIRED: "Essai expiré",
  ACTIVE: "Actif",
  EXPIRED: "Expiré",
  SUSPENDED: "Suspendu",
  PENDING_DELETION: "Suppression",
};

export const PLATFORM_ACCESS_STATUS_STYLES: Record<PlatformAccessStatus, string> = {
  PENDING_CHOICE: "bg-amber-50 text-amber-800 ring-amber-200",
  TRIAL: "bg-sky-50 text-sky-800 ring-sky-200",
  TRIAL_EXPIRED: "bg-orange-50 text-orange-800 ring-orange-200",
  ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  EXPIRED: "bg-slate-100 text-slate-700 ring-slate-200",
  SUSPENDED: "bg-red-50 text-red-800 ring-red-200",
  PENDING_DELETION: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function isPlatformAccessStatus(value: string): value is PlatformAccessStatus {
  return PLATFORM_ACCESS_STATUSES.includes(value as PlatformAccessStatus);
}
