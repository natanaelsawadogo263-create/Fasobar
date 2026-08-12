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
  const saved = cookieStore.get(ACTIVITY_COOKIE)?.value;
  const initialActivity = isSelectableActivityId(saved) ? saved : "";

  return (
    <div className="h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain bg-slate-50">
      <div className="mx-auto flex min-h-full w-full items-center justify-center px-4 py-8 sm:py-12">
        <OnboardingForm initialActivity={initialActivity} />
      </div>
    </div>
  );
}

