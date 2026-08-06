import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { isActivePlatformAdmin } from "@/lib/platform/auth";

export default async function AccessDeniedPage() {
  const user = await requireAuthenticatedUser();

  if (await isActivePlatformAdmin()) {
    redirect("/platform");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-red-700">
          Accès refusé
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          Espace Super Admin réservé
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Votre compte ({user.email ?? "sans e-mail"}) n&apos;a pas les droits Super Admin
          actifs pour accéder à /platform.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/application"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            Retour à l&apos;application
          </Link>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
