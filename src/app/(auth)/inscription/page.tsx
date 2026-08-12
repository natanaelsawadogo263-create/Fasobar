import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/auth/sign-up-form";
import {
  ACTIVITY_COOKIE,
  getBusinessActivity,
  isSelectableActivityId,
} from "@/lib/auth/activities";
import { redirectIfAuthenticated } from "@/lib/auth/session";

export default async function InscriptionPage() {
  await redirectIfAuthenticated();

  const cookieStore = await cookies();
  const activity = cookieStore.get(ACTIVITY_COOKIE)?.value;
  if (!isSelectableActivityId(activity)) {
    redirect("/inscription/activite");
  }

  return (
    <SignUpForm activityLabel={getBusinessActivity(activity)?.label ?? ""} />
  );
}
