import { redirect } from "next/navigation";

import { requireAuthenticatedUser, userHasActiveOrganization } from "@/lib/auth/session";
import { isActivePlatformAdmin } from "@/lib/platform/auth";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default async function OnboardingPage() {
  const user = await requireAuthenticatedUser();

  if (await isActivePlatformAdmin()) {
    redirect("/platform");
  }

  if (await userHasActiveOrganization(user.id)) {
    redirect("/application");
  }

  return (
    <div className="h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain bg-slate-50">
      <div className="mx-auto flex min-h-full w-full items-center justify-center px-4 py-8 sm:py-12">
        <OnboardingForm />
      </div>
    </div>
  );
}
