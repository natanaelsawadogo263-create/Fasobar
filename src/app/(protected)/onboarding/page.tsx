import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import { ACTIVITY_COOKIE, isSelectableActivityId } from "@/lib/auth/activities";
import { requireAuthenticatedUser, userHasActiveOrganization } from "@/lib/auth/session";
import { isActivePlatformAdmin } from "@/lib/platform/auth";

export default async function OnboardingPage() {
  const user = await requireAuthenticatedUser();

  if (await isActivePlatformAdmin()) {
    redirect("/platform");
  }

  if (await userHasActiveOrganization(user.id)) {
    redirect("/application");
  }

  const cookieStore = await cookies();
  // Cookie du navigateur d'inscription, sinon l'activité enregistrée dans le
  // compte (lien de confirmation ouvert sur un autre appareil).
  const fromCookie = cookieStore.get(ACTIVITY_COOKIE)?.value;
  const fromAccount = user.user_metadata?.activity_code as string | undefined;
  const initialActivity = isSelectableActivityId(fromCookie)
    ? fromCookie
    : isSelectableActivityId(fromAccount)
      ? fromAccount
      : "";

  return (
    <div className="h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain bg-slate-50">
      <div className="mx-auto flex min-h-full w-full items-center justify-center px-4 py-8 sm:py-12">
        <OnboardingForm initialActivity={initialActivity} />
      </div>
    </div>
  );
}

