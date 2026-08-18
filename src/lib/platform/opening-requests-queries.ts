import "server-only";

import { getBusinessActivity } from "@/lib/auth/activities";
import { createClient } from "@/lib/supabase/server";

export type EstablishmentOpeningRequest = {
  organizationId: string;
  establishmentId: string;
  organizationName: string;
  establishmentName: string;
  establishmentCity: string | null;
  activityCode: string | null;
  activityLabel: string | null;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  requestedAt: string;
};

export type EstablishmentOpeningRequestsResult = {
  requests: EstablishmentOpeningRequest[];
  error: string | null;
};

function isMissingTableError(message: string): boolean {
  return /Could not find the table|schema cache|does not exist|PGRST205/i.test(
    message,
  );
}

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function listPendingEstablishmentOpeningRequests(): Promise<EstablishmentOpeningRequestsResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("establishment_opening_requests")
      .select(
        `
        organization_id,
        establishment_id,
        requested_at,
        requested_by,
        organizations ( id, name, phone ),
        establishments ( id, name, city, activity_code ),
        profiles!establishment_opening_requests_requested_by_fkey ( full_name, phone )
      `,
      )
      .eq("status", "PENDING")
      .order("requested_at", { ascending: true });

    if (error) {
      if (isMissingTableError(error.message)) {
        return { requests: [], error: null };
      }
      console.error("[platform] opening requests:", error.message);
      return { requests: [], error: error.message };
    }

    const requests = (data ?? []).flatMap((row) => {
      const organization = readSingle(
        row.organizations as
          | { id: string; name: string; phone: string | null }
          | Array<{ id: string; name: string; phone: string | null }>
          | null,
      );
      const establishment = readSingle(
        row.establishments as
          | {
              id: string;
              name: string;
              city: string | null;
              activity_code: string | null;
            }
          | Array<{
              id: string;
              name: string;
              city: string | null;
              activity_code: string | null;
            }>
          | null,
      );
      const profile = readSingle(
        row.profiles as
          | { full_name: string | null; phone: string | null }
          | Array<{ full_name: string | null; phone: string | null }>
          | null,
      );
      if (!organization || !establishment) return [];

      const activityCode = establishment.activity_code;
      return [
        {
          organizationId: row.organization_id as string,
          establishmentId: row.establishment_id as string,
          organizationName: organization.name,
          establishmentName: establishment.name,
          establishmentCity: establishment.city,
          activityCode,
          activityLabel: activityCode
            ? (getBusinessActivity(activityCode)?.label ?? null)
            : null,
          ownerName: profile?.full_name?.trim() || "—",
          ownerEmail: null,
          ownerPhone: profile?.phone ?? organization.phone ?? null,
          requestedAt: row.requested_at as string,
        },
      ];
    });

    return { requests, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inattendue.";
    return { requests: [], error: message };
  }
}

export async function countPendingEstablishmentOpeningRequests(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("establishment_opening_requests")
      .select("organization_id", { count: "exact", head: true })
      .eq("status", "PENDING");

    if (error) {
      if (isMissingTableError(error.message)) return 0;
      return 0;
    }
    return count ?? 0;
  } catch {
    return 0;
  }
}
