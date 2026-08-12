import { cookies } from "next/headers";

import { ActivityChoiceForm } from "@/components/auth/activity-choice-form";
import { ACTIVITY_COOKIE, isSelectableActivityId } from "@/lib/auth/activities";
import { redirectIfAuthenticated } from "@/lib/auth/session";

export default async function InscriptionActivitePage() {
  await redirectIfAuthenticated();

  const cookieStore = await cookies();
  const saved = cookieStore.get(ACTIVITY_COOKIE)?.value;
  const initialActivity = isSelectableActivityId(saved) ? saved : "";

  return <ActivityChoiceForm initialActivity={initialActivity} />;
}
