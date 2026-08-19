import type { Metadata } from "next";

import { UsersWorkspace } from "@/components/users/users-workspace";
import { requireGasStationAdminContext } from "@/lib/auth/workspace-context";
import { requireCloudOnlineForDesktop } from "@/lib/desktop/require-cloud-online";
import { listUsersPageData } from "@/lib/users/queries";

export const metadata: Metadata = {
  title: "Employés — Station",
};

type StationEmployesPageProps = {
  searchParams: Promise<{ create?: string }>;
};

export default async function StationEmployesPage({
  searchParams,
}: StationEmployesPageProps) {
  await requireCloudOnlineForDesktop("/application/station/employes");
  const workspace = await requireGasStationAdminContext();
  const params = await searchParams;
  const data = await listUsersPageData(workspace);

  return (
    <UsersWorkspace
      {...data}
      defaultEstablishmentId={workspace.establishmentId}
      openCreateOnMount={params.create === "1"}
      serviceScope={workspace.serviceScope}
      activityCode={workspace.activityCode}
      pageTitle="Employés"
    />
  );
}
