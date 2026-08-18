import { PlatformOpeningRequestsWorkspace } from "@/components/platform/platform-opening-requests-workspace";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { listPendingEstablishmentOpeningRequests } from "@/lib/platform/opening-requests-queries";

export default async function PlatformDemandesEtablissementPage() {
  await requirePlatformAdmin();
  const { requests, error } = await listPendingEstablishmentOpeningRequests();

  return (
    <PlatformOpeningRequestsWorkspace requests={requests} error={error} />
  );
}
