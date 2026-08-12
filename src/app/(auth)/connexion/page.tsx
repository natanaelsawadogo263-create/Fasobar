import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ConnexionScreen } from "@/components/auth/connexion-screen";
import { redirectIfAuthenticated } from "@/lib/auth/session";

type ConnexionPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function ConnexionPage({ searchParams }: ConnexionPageProps) {
  const cookieStore = await cookies();
  if (cookieStore.get("fb_pw_recovery")?.value === "1") {
    redirect("/nouveau-mot-de-passe");
  }

  await redirectIfAuthenticated();

  const params = searchParams ? await searchParams : undefined;
  const authError =
    params?.error === "auth"
      ? "Le lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien."
      : null;

  return <ConnexionScreen authError={authError} />;
}
