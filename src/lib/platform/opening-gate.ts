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

export async function getOrganizationOpeningStatus(
  organizationId: string,
): Promise<EstablishmentOpeningStatus | null> {
  if (isDesktopServerRuntime()) {
    try {
      const { probeSupabaseReachable } = await import(
        "@/lib/desktop/cloud-reachability"
      );
      if (!(await probeSupabaseReachable())) {
        return "APPROVED";
      }
    } catch {
      return "APPROVED";
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("establishment_opening_requests")
    .select("status")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error.message)) {
      return "APPROVED";
    }
    console.error("[opening] status read failed:", error.message);
    return "PENDING";
  }

  if (!data?.status) {
    return "APPROVED";
  }

  return isEstablishmentOpeningStatus(data.status) ? data.status : "PENDING";
}

export const getOpeningRedirectForOrganization = cache(
  async (organizationId: string): Promise<string | null> => {
    const status = await getOrganizationOpeningStatus(organizationId);
    return resolveOpeningRedirect(status);
  },
);
