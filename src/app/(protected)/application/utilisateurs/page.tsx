import { UsersWorkspace } from "@/components/users/users-workspace";
import { requireAdminContext } from "@/lib/auth/workspace-context";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";
import { listUsersPageData } from "@/lib/users/queries";

type UtilisateursPageProps = {
  searchParams: Promise<{ create?: string }>;
};

export default async function UtilisateursPage({ searchParams }: UtilisateursPageProps) {
  await requireCloudOnlineForDesktop("/application/utilisateurs");
  const workspace = await requireAdminContext();
  const params = await searchParams;
  const data = await listUsersPageData(workspace);

  return (
    <UsersWorkspace
      {...data}
      defaultEstablishmentId={workspace.establishmentId}
      openCreateOnMount={params.create === "1"}
    />
  );
}
