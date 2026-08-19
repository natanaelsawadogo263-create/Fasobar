import "server-only";

import { cache } from "react";

import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import {
  isEstablishmentOpeningStatus,
  resolveOpeningRedirect,
  type EstablishmentOpeningStatus,
} from "@/lib/platform/opening-access";
import { createClient } from "@/lib/supabase/server";

function isMissingRelation(message: string): boolean {
  return /Could not find the table|schema cache|does not exist|PGRST205|PGRST204/i.test(
    message,
  );
}

export type OrganizationOpeningRequest = {
  status: EstablishmentOpeningStatus | null;
  requestedAt: string | null;
};

const APPROVED_REQUEST: OrganizationOpeningRequest = {
  status: "APPROVED",
  requestedAt: null,
};

export async function getOrganizationOpeningRequest(
  organizationId: string,
): Promise<OrganizationOpeningRequest> {
  if (isDesktopServerRuntime()) {
    try {
      const { probeSupabaseReachable } = await import(
        "@/lib/desktop/cloud-reachability"
      );
      if (!(await probeSupabaseReachable())) {
        return APPROVED_REQUEST;
      }
    } catch {
      return APPROVED_REQUEST;
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("establishment_opening_requests")
    .select("status, requested_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error.message)) {
      return APPROVED_REQUEST;
    }
    console.error("[opening] status read failed:", error.message);
    return { status: "PENDING", requestedAt: null };
  }

  if (!data?.status) {
    return APPROVED_REQUEST;
  }

  return {
    status: isEstablishmentOpeningStatus(data.status)
      ? data.status
      : "PENDING",
    requestedAt:
      typeof data.requested_at === "string" ? data.requested_at : null,
  };
}

export async function getOrganizationOpeningStatus(
  organizationId: string,
): Promise<EstablishmentOpeningStatus | null> {
  const { status } = await getOrganizationOpeningRequest(organizationId);
  return status;
}

export const getOpeningRedirectForOrganization = cache(
  async (organizationId: string): Promise<string | null> => {
    const status = await getOrganizationOpeningStatus(organizationId);
    return resolveOpeningRedirect(status);
  },
);
