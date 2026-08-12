import { redirect } from "next/navigation";

import { AbonnementWorkspace } from "@/components/abonnement/abonnement-workspace";
import { getOwnerAbonnementData } from "@/lib/abonnement/queries";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

type Props = {
  searchParams?: Promise<{ renouveler?: string }>;
};

export default async function AbonnementPage({ searchParams }: Props) {
  await requireCloudOnlineForDesktop("/abonnement");
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
