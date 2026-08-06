"use server";

import { redirect } from "next/navigation";

import { mapGenericError } from "@/lib/auth/errors";
import { onboardingSchema } from "@/lib/auth/schemas";
import type { AuthActionState } from "@/lib/auth/types";
import { requireAuthenticatedUser, userHasActiveOrganization } from "@/lib/auth/session";
import { getBootstrapBlockedMessage } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

export async function bootstrapOrganizationAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const user = await requireAuthenticatedUser();

  if (await userHasActiveOrganization(user.id)) {
    return { error: getBootstrapBlockedMessage(true)! };
  }

  const parsed = onboardingSchema.safeParse({
    organizationName: formData.get("organizationName"),
    organizationSlug: formData.get("organizationSlug"),
    phone: formData.get("phone") || undefined,
    establishmentName: formData.get("establishmentName"),
    establishmentSlug: formData.get("establishmentSlug"),
    establishmentType: formData.get("establishmentType"),
    address: formData.get("address") || undefined,
    city: formData.get("city"),
    country: formData.get("country") || "Burkina Faso",
    currency: formData.get("currency") || "XOF",
    timezone: formData.get("timezone") || "Africa/Ouagadougou",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("bootstrap_organization", {
    organization_name: parsed.data.organizationName,
    organization_slug: parsed.data.organizationSlug,
    establishment_name: parsed.data.establishmentName,
    establishment_slug: parsed.data.establishmentSlug,
    establishment_type: parsed.data.establishmentType,
    phone: parsed.data.phone ?? null,
    address: parsed.data.address ?? null,
    city: parsed.data.city,
    country: parsed.data.country,
    currency: parsed.data.currency,
    timezone: parsed.data.timezone,
  });

  if (error) {
    return { error: mapGenericError(error) };
  }

  redirect("/onboarding/employes");
}
