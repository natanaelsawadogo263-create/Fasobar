"use server";

import { redirect } from "next/navigation";

import { mapGenericError } from "@/lib/auth/errors";
import { onboardingSchema } from "@/lib/auth/schemas";
import { mapActivityToEstablishmentType } from "@/lib/auth/activities";
import { getActivityProfile } from "@/lib/activity/profile";
import type { AuthActionState } from "@/lib/auth/types";
import { requireAuthenticatedUser, userHasActiveOrganization } from "@/lib/auth/session";
import { getBootstrapBlockedMessage } from "@/lib/auth/routes";
import { withUniqueSlugSuffix } from "@/lib/auth/slugs";
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
    activityCode: formData.get("activityCode"),
    address: formData.get("address") || undefined,
    city: formData.get("city"),
    country: formData.get("country") || "Burkina Faso",
    currency: formData.get("currency") || "XOF",
    timezone: formData.get("timezone") || "Africa/Ouagadougou",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const salt = user.id.replace(/-/g, "");
  const organizationSlug = withUniqueSlugSuffix(
    parsed.data.organizationSlug,
    salt,
  );
  const establishmentSlug = withUniqueSlugSuffix(
    parsed.data.establishmentSlug,
    `${salt}e`,
  );

  const establishmentType = mapActivityToEstablishmentType(parsed.data.activityCode);

  const supabase = await createClient();

  let { data, error } = await supabase.rpc("bootstrap_organization", {
    organization_name: parsed.data.organizationName,
    organization_slug: organizationSlug,
    establishment_name: parsed.data.establishmentName,
    establishment_slug: establishmentSlug,
    establishment_type: establishmentType,
    phone: parsed.data.phone ?? null,
    address: parsed.data.address ?? null,
    city: parsed.data.city,
    country: parsed.data.country,
    currency: parsed.data.currency,
    timezone: parsed.data.timezone,
  });

  if (error && establishmentType === "COMMERCE") {
    const retry = await supabase.rpc("bootstrap_organization", {
      organization_name: parsed.data.organizationName,
      organization_slug: organizationSlug,
      establishment_name: parsed.data.establishmentName,
      establishment_slug: establishmentSlug,
      establishment_type: "RESTAURANT_MAQUIS",
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
      city: parsed.data.city,
      country: parsed.data.country,
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
    });
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error(
      "[bootstrap_organization]",
      error.code,
      error.message,
      error.details,
      error.hint,
    );
    return { error: mapGenericError(error) };
  }

  const establishmentId = Array.isArray(data)
    ? data[0]?.establishment_id
    : (data as { establishment_id?: string } | null)?.establishment_id;

  if (establishmentId) {
    const profile = getActivityProfile(parsed.data.activityCode);
    await supabase
      .from("establishments")
      .update({
        activity_code: parsed.data.activityCode,
        ...(profile.kind === "retail" ? { service_scope: "BAR" } : {}),
      })
      .eq("id", establishmentId);
  }

  redirect("/attente-validation");
}
