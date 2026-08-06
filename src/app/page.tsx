import { redirect } from "next/navigation";

import { resolvePostLoginPath } from "@/lib/auth/routes";
import {
  getAuthenticatedUser,
  userHasActiveOrganization,
} from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/connexion");
  }

  const hasOrganization = await userHasActiveOrganization(user.id);
  redirect(resolvePostLoginPath(hasOrganization));
}
