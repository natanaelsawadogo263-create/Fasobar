import "server-only";

import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PlatformAccessStatus } from "@/lib/platform/statuses";

export type PlatformClientIdentity = {
  organizationId: string;
  organizationName: string;
  organizationCreatedAt: string;
  accessStatus: PlatformAccessStatus;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerProfileStatus: "ACTIVE" | "INACTIVE" | null;
};

export type PlatformClientEstablishment = {
  id: string;
  name: string;
  type: string | null;
  city: string | null;
  quartier: string | null;
  status: string;
  createdAt: string;
};

export type PlatformClientEmployee = {
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  establishmentName: string | null;
  profileStatus: string;
  membershipStatus: string;
};

export type PlatformTrialExtension = {
  at: string | null;
  previousEndsAt: string | null;
  newEndsAt: string | null;
  grantedBy: string | null;
  note: string | null;
};

export type PlatformClientTrial = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  daysRemaining: number | null;
  extensions: PlatformTrialExtension[];
};

export type PlatformClientAccess = {
  status: PlatformAccessStatus;
  previousStatus: PlatformAccessStatus | null;
  statusChangedAt: string;
  deletionRequestedAt: string | null;
  deletionPurgeAfter: string | null;
};

export type PlatformClientSubscription = {
  id: string;
  status: string;
  planName: string | null;
  billingPeriod: string;
  startsAt: string;
  endsAt: string;
  amountPaidXof: number;
  isCurrent: boolean;
};

export type PlatformClientMachine = {
  id: string;
  deviceId: string;
  displayName: string | null;
  establishmentName: string | null;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
};

export type PlatformClientLicense = {
  id: string;
  status: string;
  version: number;
  issuedAt: string;
  expiresAt: string;
  maxMachines: number;
};

export type PlatformClientPayment = {
  id: string;
  amountXof: number;
  transactionReference: string | null;
  paidAt: string;
  channel: string;
};

export type PlatformClientAuditEvent = {
  id: string;
  action: string;
  entityType: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type PlatformClientDetail = {
  identity: PlatformClientIdentity;
  access: PlatformClientAccess;
  establishments: PlatformClientEstablishment[];
  employees: PlatformClientEmployee[];
  trial: PlatformClientTrial | null;
  subscription: PlatformClientSubscription | null;
  machines: PlatformClientMachine[];
  licenses: PlatformClientLicense[];
  payments: PlatformClientPayment[];
  auditEvents: PlatformClientAuditEvent[];
};

export type PlatformClientDetailResult =
  | { kind: "ok"; detail: PlatformClientDetail }
  | { kind: "not_found" }
  | { kind: "error"; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isOrganizationId(value: string): boolean {
  return UUID_RE.test(value);
}

async function fetchEmails(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  if (!isAdminClientConfigured() || userIds.length === 0) return emails;

  try {
    const admin = createAdminClient();
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const { data } = await admin.auth.admin.getUserById(userId);
          if (data.user?.email) {
            emails.set(userId, data.user.email.toLowerCase());
          }
        } catch (error) {
          console.error("[platform] detail email fetch failed:", userId, error);
        }
      }),
    );
  } catch (error) {
    console.error("[platform] admin client unavailable:", error);
  }

  return emails;
}

function parseExtensions(raw: unknown): PlatformTrialExtension[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      at: typeof row.at === "string" ? row.at : null,
      previousEndsAt:
        typeof row.previous_ends_at === "string"
          ? row.previous_ends_at
          : typeof row.previousEndsAt === "string"
            ? row.previousEndsAt
            : null,
      newEndsAt:
        typeof row.new_ends_at === "string"
          ? row.new_ends_at
          : typeof row.newEndsAt === "string"
            ? row.newEndsAt
            : null,
      grantedBy:
        typeof row.granted_by === "string"
          ? row.granted_by
          : typeof row.grantedBy === "string"
            ? row.grantedBy
            : null,
      note: typeof row.note === "string" ? row.note : null,
    };
  });
}

function daysRemaining(endsAt: string, now: Date): number | null {
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isMissingTableError(message: string): boolean {
  return /Could not find the table|schema cache|does not exist|PGRST205/i.test(
    message,
  );
}

/**
 * Fiche client Super Admin. not_found si l'organisation n'existe pas.
 */
export async function getPlatformClientDetail(
  organizationId: string,
): Promise<PlatformClientDetailResult> {
  if (!isOrganizationId(organizationId)) {
    return { kind: "not_found" };
  }

  try {
    const supabase = await createClient();
    const now = new Date();

    const [
      orgResult,
      stateResult,
      ownerResult,
      establishmentsResult,
      orgMembershipsResult,
      trialResult,
      subscriptionResult,
      machinesResult,
      licensesResult,
      paymentsResult,
      auditResult,
      plansResult,
    ] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, created_at")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase
        .from("organization_platform_states")
        .select(
          "status, previous_status, status_changed_at, deletion_requested_at, deletion_purge_after",
        )
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("organization_memberships")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("role", "OWNER")
        .eq("status", "ACTIVE")
        .maybeSingle(),
      supabase
        .from("establishments")
        .select("id, name, establishment_type, city, address, status, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),
      supabase
        .from("organization_memberships")
        .select("user_id, role, status")
        .eq("organization_id", organizationId)
        .neq("role", "OWNER"),
      supabase
        .from("organization_trials")
        .select("id, status, starts_at, ends_at, extension_history")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("organization_subscriptions")
        .select(
          "id, status, plan_id, billing_period, starts_at, ends_at, amount_paid_xof, is_current",
        )
        .eq("organization_id", organizationId)
        .eq("is_current", true)
        .maybeSingle(),
      supabase
        .from("registered_machines")
        .select(
          "id, device_id, display_name, establishment_id, status, last_seen_at, created_at",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_licenses")
        .select("id, status, version, issued_at, expires_at, max_machines")
        .eq("organization_id", organizationId)
        .order("issued_at", { ascending: false })
        .limit(10),
      supabase
        .from("platform_subscription_payments")
        .select("id, amount_xof, transaction_reference, paid_at, channel")
        .eq("organization_id", organizationId)
        .order("paid_at", { ascending: false })
        .limit(20),
      supabase
        .from("platform_audit_logs")
        .select("id, action, entity_type, created_at, metadata")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("subscription_plans").select("id, name"),
    ]);

    const firstError =
      orgResult.error?.message ||
      stateResult.error?.message ||
      ownerResult.error?.message ||
      establishmentsResult.error?.message ||
      orgMembershipsResult.error?.message ||
      trialResult.error?.message ||
      null;

    if (firstError) {
      console.error("[platform] getPlatformClientDetail query error:", firstError);
      return { kind: "error", error: firstError };
    }

    const softWarn = (label: string, err: { message: string } | null) => {
      if (err && !isMissingTableError(err.message)) {
        console.error(`[platform] client detail ${label}:`, err.message);
      }
    };
    softWarn("subscription", subscriptionResult.error);
    softWarn("machines", machinesResult.error);
    softWarn("licenses", licensesResult.error);
    softWarn("payments", paymentsResult.error);
    softWarn("audit", auditResult.error);

    if (!orgResult.data) {
      return { kind: "not_found" };
    }

    const org = orgResult.data;
    const state = stateResult.data;
    const ownerUserId = ownerResult.data?.user_id ?? null;
    const establishments = establishmentsResult.data ?? [];
    const employeeMemberships = orgMembershipsResult.data ?? [];
    const employeeIds = employeeMemberships.map((m) => m.user_id);
    const profileIds = [
      ...new Set([...(ownerUserId ? [ownerUserId] : []), ...employeeIds]),
    ];

    const [profilesResult, estMembershipsResult, emailsByUserId] = await Promise.all([
      profileIds.length
        ? supabase
            .from("profiles")
            .select("id, full_name, phone, status")
            .in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
      establishments.length
        ? supabase
            .from("establishment_memberships")
            .select("user_id, establishment_id, status")
            .in(
              "establishment_id",
              establishments.map((e) => e.id),
            )
        : Promise.resolve({ data: [], error: null }),
      fetchEmails(profileIds),
    ]);

    if (profilesResult.error) {
      return { kind: "error", error: profilesResult.error.message };
    }
    if (estMembershipsResult.error) {
      return { kind: "error", error: estMembershipsResult.error.message };
    }

    const profileById = new Map(
      (profilesResult.data ?? []).map((p) => [p.id, p] as const),
    );
    const establishmentById = new Map(establishments.map((e) => [e.id, e] as const));

    const primaryEstablishmentByUser = new Map<string, string>();
    for (const row of estMembershipsResult.data ?? []) {
      if (!primaryEstablishmentByUser.has(row.user_id)) {
        const est = establishmentById.get(row.establishment_id);
        primaryEstablishmentByUser.set(row.user_id, est?.name ?? "Établissement");
      }
    }

    const ownerProfile = ownerUserId ? profileById.get(ownerUserId) : null;

    const identity: PlatformClientIdentity = {
      organizationId: org.id,
      organizationName: org.name,
      organizationCreatedAt: org.created_at,
      accessStatus: (state?.status ?? "PENDING_CHOICE") as PlatformAccessStatus,
      ownerUserId,
      ownerName: ownerProfile?.full_name ?? null,
      ownerEmail: ownerUserId ? (emailsByUserId.get(ownerUserId) ?? null) : null,
      ownerPhone: ownerProfile?.phone ?? null,
      ownerProfileStatus:
        ownerProfile?.status === "INACTIVE"
          ? "INACTIVE"
          : ownerProfile
            ? "ACTIVE"
            : null,
    };

    const access: PlatformClientAccess = {
      status: (state?.status ?? "PENDING_CHOICE") as PlatformAccessStatus,
      previousStatus: (state?.previous_status as PlatformAccessStatus | null) ?? null,
      statusChangedAt: state?.status_changed_at ?? org.created_at,
      deletionRequestedAt: state?.deletion_requested_at ?? null,
      deletionPurgeAfter: state?.deletion_purge_after ?? null,
    };

    const establishmentRows: PlatformClientEstablishment[] = establishments.map(
      (e) => ({
        id: e.id,
        name: e.name,
        type: e.establishment_type ?? null,
        city: e.city ?? null,
        quartier: e.address ?? null,
        status: e.status,
        createdAt: e.created_at,
      }),
    );

    const employees: PlatformClientEmployee[] = employeeMemberships.map((m) => {
      const profile = profileById.get(m.user_id);
      return {
        userId: m.user_id,
        fullName: profile?.full_name ?? null,
        email: emailsByUserId.get(m.user_id) ?? null,
        phone: profile?.phone ?? null,
        role: m.role,
        establishmentName: primaryEstablishmentByUser.get(m.user_id) ?? null,
        profileStatus: profile?.status ?? "INACTIVE",
        membershipStatus: m.status,
      };
    });

    const trialRow = trialResult.data;
    const trial: PlatformClientTrial | null = trialRow
      ? {
          id: trialRow.id,
          status: trialRow.status,
          startsAt: trialRow.starts_at,
          endsAt: trialRow.ends_at,
          daysRemaining:
            trialRow.status === "ACTIVE"
              ? daysRemaining(trialRow.ends_at, now)
              : null,
          extensions: parseExtensions(trialRow.extension_history),
        }
      : null;

    const planById = new Map(
      (plansResult.data ?? []).map((p) => [p.id, p.name] as const),
    );
    const subRow = subscriptionResult.error ? null : subscriptionResult.data;
    const subscription: PlatformClientSubscription | null = subRow
      ? {
          id: subRow.id,
          status: subRow.status,
          planName: planById.get(subRow.plan_id) ?? null,
          billingPeriod: subRow.billing_period,
          startsAt: subRow.starts_at,
          endsAt: subRow.ends_at,
          amountPaidXof: subRow.amount_paid_xof,
          isCurrent: subRow.is_current,
        }
      : null;

    const machines: PlatformClientMachine[] = machinesResult.error
      ? []
      : (machinesResult.data ?? []).map((m) => ({
          id: m.id,
          deviceId: m.device_id,
          displayName: m.display_name,
          establishmentName:
            establishmentById.get(m.establishment_id)?.name ?? null,
          status: m.status,
          lastSeenAt: m.last_seen_at,
          createdAt: m.created_at,
        }));

    const licenses: PlatformClientLicense[] = licensesResult.error
      ? []
      : (licensesResult.data ?? []).map((l) => ({
          id: l.id,
          status: l.status,
          version: l.version,
          issuedAt: l.issued_at,
          expiresAt: l.expires_at,
          maxMachines: l.max_machines,
        }));

    const payments: PlatformClientPayment[] = paymentsResult.error
      ? []
      : (paymentsResult.data ?? []).map((p) => ({
          id: p.id,
          amountXof: p.amount_xof,
          transactionReference: p.transaction_reference,
          paidAt: p.paid_at,
          channel: p.channel,
        }));

    const auditEvents: PlatformClientAuditEvent[] = auditResult.error
      ? []
      : (auditResult.data ?? []).map((a) => ({
          id: a.id,
          action: a.action,
          entityType: a.entity_type,
          createdAt: a.created_at,
          metadata:
            a.metadata && typeof a.metadata === "object"
              ? (a.metadata as Record<string, unknown>)
              : {},
        }));

    return {
      kind: "ok",
      detail: {
        identity,
        access,
        establishments: establishmentRows,
        employees,
        trial,
        subscription,
        machines,
        licenses,
        payments,
        auditEvents,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inattendue.";
    console.error("[platform] getPlatformClientDetail failed:", error);
    return { kind: "error", error: message };
  }
}
