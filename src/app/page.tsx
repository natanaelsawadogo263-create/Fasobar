import { redirect } from "next/navigation";

import { resolvePostLoginRedirect } from "@/lib/auth/post-login";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { SignInForm } from "@/components/auth/sign-in-form";
import { createClient } from "@/lib/supabase/server";

/**
 * Porte d'entrée FasoBar = toujours l'écran de connexion,
 * sauf session active autorisée → redirection vers l'espace.
 */
export default async function HomePage() {
  const user = await getAuthenticatedUser();

  if (user) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    // Session fantôme / compte désactivé : revenir à la connexion
    if (!profile || profile.status === "INACTIVE") {
      await supabase.auth.signOut();
    } else {
      redirect(await resolvePostLoginRedirect(user.id));
    }
  }

  return (
    <div className="h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain bg-slate-50">
      <div className="mx-auto flex min-h-full w-full items-center justify-center px-4 py-8 sm:py-12">
        <SignInForm />
      </div>
    </div>
  );
}
