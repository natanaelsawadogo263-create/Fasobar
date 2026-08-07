import { MonAbonnementWorkspace } from "@/components/admin/mon-abonnement-workspace";
import { getOwnerAbonnementData } from "@/lib/abonnement/queries";
import { requireAdminContext } from "@/lib/auth/workspace-context";

export default async function MonAbonnementPage() {
  const workspace = await requireAdminContext();
  const data = await getOwnerAbonnementData(
    workspace.organizationId,
    workspace.organizationName,
  );

  const canRenew = workspace.organizationRole === "OWNER";

  return <MonAbonnementWorkspace data={data} canRenew={canRenew} />;
}
