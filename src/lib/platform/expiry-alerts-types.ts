export type PlatformExpiryAlert = {
  id: string;
  kind: "trial" | "subscription";
  organizationId: string;
  organizationName: string;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  billingPhone: string | null;
  planName: string | null;
  endsAt: string;
  daysRemaining: number;
  urgency: "warning" | "critical";
};

export type PlatformExpiryAlertsResult = {
  warningDays: number;
  alerts: PlatformExpiryAlert[];
  error: string | null;
};
