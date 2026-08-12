import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ConnexionScreen } from "@/components/auth/connexion-screen";
import { MarketingHomePage } from "@/components/marketing/home-page";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import { createClient } from "@/lib/supabase/server";

type HomePageProps = {
  searchParams?: Promise<{ error?: string; redirect?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const desktopMode = isDesktopServerRuntime();
  const cookieStore = await cookies();

  if (cookieStore.get("fb_pw_recovery")?.value === "1") {
    redirect("/nouveau-mot-de-passe");
  }

  const user = await getAuthenticatedUser();

  if (user) {
    if (desktopMode) {
      redirect(await resolvePostLoginRedirect(user.id));
    }

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.status === "INACTIVE") {
      await supabase.auth.signOut();
    } else {
      redirect(await resolvePostLoginRedirect(user.id));
    }
  }

  const authError =
    params?.error === "auth"
      ? "Le lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien."
      : null;

  if (desktopMode) {
    return <ConnexionScreen authError={authError} />;
  }

  return (
    <MarketingShell>
      <MarketingHomePage />
    </MarketingShell>
  );
}
