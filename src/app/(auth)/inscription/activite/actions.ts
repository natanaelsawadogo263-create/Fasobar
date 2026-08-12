"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ACTIVITY_COOKIE,
  isSelectableActivityId,
} from "@/lib/auth/activities";
import { getAuthenticatedUser } from "@/lib/auth/session";

export async function saveActivityChoiceAction(formData: FormData) {
  const activityCode = String(formData.get("activityCode") ?? "");

  if (!isSelectableActivityId(activityCode)) {
    redirect("/inscription/activite");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVITY_COOKIE, activityCode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  const user = await getAuthenticatedUser();
  redirect(user ? "/onboarding" : "/inscription");
}
