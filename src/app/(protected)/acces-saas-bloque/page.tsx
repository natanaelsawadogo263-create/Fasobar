import Link from "next/link";

import { signOutAction } from "@/lib/auth/actions";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { getOrganizationSaasAccess } from "@/lib/platform/saas-gate";
import { PLATFORM_ACCESS_STATUS_LABELS } from "@/lib/platform/statuses";

export default async function AccesSaasBloquePage() {
  const user = await requireAuthenticatedUser();
  const workspace = await getWorkspaceContext(user.id);

  const isOwner = workspace?.organizationRole === "OWNER";
  const access = workspace
    ? await getOrganizationSaasAccess(workspace.organizationId)
    : null;

  const statusLabel = access
    ? PLATFORM_ACCESS_STATUS_LABELS[access.status] ?? access.status
    : null;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f4f6f9] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-emerald-700">
          FasoBar
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          Accès SaaS indisponible
        </h1>

        {isOwner ? (
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <p>
              L’accès de votre organisation est actuellement{" "}
              <span className="font-semibold text-slate-900">
                {statusLabel ?? "bloqué"}
              </span>
              .
            </p>
            {access?.status === "SUSPENDED" ||
            access?.status === "PENDING_DELETION" ? (
              <p>
                Contactez le support FasoBar pour rétablir l’accès. La zone
                abonnement n’est pas disponible dans cet état.
              </p>
            ) : (
              <p>
                Gérez votre essai ou votre abonnement pour retrouver l’application
                métier.
              </p>
            )}
            {access?.status !== "SUSPENDED" &&
            access?.status !== "PENDING_DELETION" ? (
              <Link
                href="/abonnement"
                className="inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-[13px] font-semibold text-white"
              >
                Aller à l’abonnement
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <p>
              L’accès à l’application est temporairement suspendu pour votre
              établissement
              {statusLabel ? (
                <>
                  {" "}
                  (état :{" "}
                  <span className="font-semibold text-slate-900">
                    {statusLabel}
                  </span>
                  )
                </>
              ) : null}
              .
            </p>
            <p>
              Seul le propriétaire de l’organisation peut régulariser
              l’abonnement. Contactez-le ou réessayez plus tard.
            </p>
          </div>
        )}

        <form action={signOutAction} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
