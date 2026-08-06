import { redirect } from "next/navigation";

import { redirectIfAuthenticated } from "@/lib/auth/session";

/** Alias : la connexion se fait sur la page d'accueil `/`. */
export default async function ConnexionPage() {
  await redirectIfAuthenticated();
  redirect("/");
}
