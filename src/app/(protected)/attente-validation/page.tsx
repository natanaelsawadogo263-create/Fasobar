import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AttenteValidationScreen } from "@/components/auth/attente-validation-screen";
import { getBusinessActivity } from "@/lib/auth/activities";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login";
import { getOrganizationOpeningRequest } from "@/lib/platform/opening-gate";
import { isActivePlatformAdmin } from "@/lib/platform/auth";

export const metadata: Metadata = {
  title: "Confirmation Super Admin — FasoBar",
};

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

  const opening = await getOrganizationOpeningRequest(workspace.organizationId);

  if (opening.status === "APPROVED" || opening.status === null) {
    redirect(await resolvePostLoginRedirect(user.id));
  }

  const refused = params.refused === "1" || opening.status === "REJECTED";

  return (
    <AttenteValidationScreen
      refused={refused}
      ownerName={workspace.ownerName}
      establishmentName={workspace.establishmentName}
      organizationName={workspace.organizationName}
      email={workspace.email || null}
      activityLabel={
        getBusinessActivity(workspace.activityCode)?.label ?? null
      }
      requestedAt={opening.requestedAt}
    />
  );
}
