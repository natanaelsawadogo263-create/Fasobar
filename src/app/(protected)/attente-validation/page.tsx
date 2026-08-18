import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login";
import { getOrganizationOpeningStatus } from "@/lib/platform/opening-gate";
import { isActivePlatformAdmin } from "@/lib/platform/auth";

type AttenteValidationPageProps = {
  searchParams: Promise<{ refused?: string }>;
};

export default async function AttenteValidationPage({
  searchParams,
}: AttenteValidationPageProps) {
  const user = await requireAuthenticatedUser();
  const params = await searchParams;

  if (await isActivePlatformAdmin()) {
    redirect("/platform");
  }

  const workspace = await getWorkspaceContext(user.id);
  if (!workspace) {
    redirect("/onboarding");
  }

  const status = await getOrganizationOpeningStatus(workspace.organizationId);

  if (status === "APPROVED" || status === null) {
    redirect(await resolvePostLoginRedirect(user.id));
  }

  const refused = params.refused === "1" || status === "REJECTED";

  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f6f4] px-4 py-8">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <FasoBarLogo size="md" className="mb-6" />

          {refused ? (
            <>
              <p className="text-sm font-semibold uppercase tracking-wide text-red-700">
                Demande refusée
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-slate-900">
                Ouverture non confirmée
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                Votre demande pour ouvrir{" "}
                <span className="font-medium text-slate-900">
                  {workspace.establishmentName}
                </span>{" "}
                n&apos;a pas été acceptée par l&apos;équipe FasoBar.
              </p>
              <p className="mt-3 text-[14px] text-slate-500">
                Contactez-nous si vous pensez qu&apos;il s&apos;agit d&apos;une
                erreur.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
                Validation en cours
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-slate-900">
                Votre espace sera ouvert très bientôt
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                Merci{" "}
                <span className="font-medium text-slate-900">
                  {workspace.ownerName}
                </span>
                . Votre demande pour{" "}
                <span className="font-medium text-slate-900">
                  {workspace.establishmentName}
                </span>{" "}
                a bien été enregistrée.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
                Un Super Admin FasoBar va vérifier vos informations. Dès
                confirmation, vous pourrez accéder à votre tableau de bord,
                votre caisse et votre stock.
              </p>
            </>
          )}

          <dl className="mt-6 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-[14px]">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Établissement
              </dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {workspace.establishmentName}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Organisation
              </dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {workspace.organizationName}
              </dd>
            </div>
            {workspace.email ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  E-mail
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {workspace.email}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contact"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              Nous contacter
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
