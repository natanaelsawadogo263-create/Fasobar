import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { getAuthenticatedUser } from "@/lib/auth/session";

export default async function NouveauMotDePassePage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    const inRecovery =
      (await cookies()).get("fb_pw_recovery")?.value === "1";
    redirect(inRecovery ? "/?error=auth" : "/mot-de-passe-oublie");
  }

  return <UpdatePasswordForm />;
}
