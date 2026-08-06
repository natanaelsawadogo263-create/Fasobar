import { PlatformDashboard } from "@/components/platform/platform-dashboard";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { getPlatformDashboardData } from "@/lib/platform/dashboard-queries";

export default async function PlatformHomePage() {
  await requirePlatformAdmin();
  const data = await getPlatformDashboardData();

  return <PlatformDashboard data={data} />;
}
