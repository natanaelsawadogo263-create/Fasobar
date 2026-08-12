import { MonAbonnementWorkspace } from "@/components/admin/mon-abonnement-workspace";
import { getOwnerAbonnementData } from "@/lib/abonnement/queries";
import { requireAdminContext } from "@/lib/auth/workspace-context";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";

export default async function MonAbonnementPage() {
  await requireCloudOnlineForDesktop("/application/mon-abonnement");
  const workspace = await requireAdminContext();
  const data = await getOwnerAbonnementData(
    workspace.organizationId,
    workspace.organizationName,
  );

  const canRenew = workspace.organizationRole === "OWNER";

  return <MonAbonnementWorkspace data={data} canRenew={canRenew} />;
}
