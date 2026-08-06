import { PlatformClientsWorkspace } from "@/components/platform/platform-clients-workspace";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { listPlatformClients } from "@/lib/platform/clients-queries";

export default async function PlatformClientsPage() {
  await requirePlatformAdmin();
  const clients = await listPlatformClients();

  return <PlatformClientsWorkspace clients={clients} />;
}
