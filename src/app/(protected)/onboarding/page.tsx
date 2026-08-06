import { redirect } from "next/navigation";

import { requireAuthenticatedUser, userHasActiveOrganization } from "@/lib/auth/session";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default async function OnboardingPage() {
  const user = await requireAuthenticatedUser();

  if (await userHasActiveOrganization(user.id)) {
    redirect("/application");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <OnboardingForm />
      </div>
    </div>
  );
}
