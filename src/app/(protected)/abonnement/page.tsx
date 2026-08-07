import { redirect } from "next/navigation";

import { AbonnementWorkspace } from "@/components/abonnement/abonnement-workspace";
import { getOwnerAbonnementData } from "@/lib/abonnement/queries";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";

type Props = {
  searchParams?: Promise<{ renouveler?: string }>;
};

export default async function AbonnementPage({ searchParams }: Props) {
  const user = await requireAuthenticatedUser();
  const workspace = await getWorkspaceContext(user.id);

  if (!workspace || workspace.organizationRole !== "OWNER") {
    redirect("/acces-saas-bloque");
  }

  const params = searchParams ? await searchParams : {};
  const renewalIntent = params.renouveler === "1";

  const data = await getOwnerAbonnementData(
    workspace.organizationId,
    workspace.organizationName,
  );

  return <AbonnementWorkspace data={data} renewalIntent={renewalIntent} />;
}
