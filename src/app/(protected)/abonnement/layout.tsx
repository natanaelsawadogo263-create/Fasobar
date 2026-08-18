import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { canOwnerAccessSubscriptionZone } from "@/lib/platform/access";
import { isActivePlatformAdmin } from "@/lib/platform/auth";
import { getOpeningRedirectForOrganization } from "@/lib/platform/opening-gate";
import { refreshAndGetOrganizationSaasAccess } from "@/lib/platform/saas-gate";

export default async function AbonnementLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAuthenticatedUser();

  if (await isActivePlatformAdmin()) {
    redirect("/platform");
  }

  const workspace = await getWorkspaceContext(user.id);
  if (!workspace) {
    redirect("/onboarding");
  }

  if (workspace.organizationRole !== "OWNER") {
    redirect("/acces-saas-bloque");
  }

  const openingRedirect = await getOpeningRedirectForOrganization(
    workspace.organizationId,
  );
  if (openingRedirect) {
    redirect(openingRedirect);
  }

  const access = await refreshAndGetOrganizationSaasAccess(
    workspace.organizationId,
  );

  if (!canOwnerAccessSubscriptionZone(access.status)) {
    redirect("/acces-saas-bloque");
  }

  return (
    <div className="h-dvh overflow-hidden bg-[#f4f6f9] text-slate-900">
      {children}
    </div>
  );
}
