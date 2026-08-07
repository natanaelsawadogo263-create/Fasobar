import { notFound } from "next/navigation";

import { PlatformClientDetailView } from "@/components/platform/platform-client-detail";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { getPlatformClientDetail } from "@/lib/platform/client-detail-queries";

type PlatformClientDetailPageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function PlatformClientDetailPage({
  params,
}: PlatformClientDetailPageProps) {
  await requirePlatformAdmin();
  const { organizationId } = await params;
  const result = await getPlatformClientDetail(organizationId);

  if (result.kind === "not_found") {
    notFound();
  }

  if (result.kind === "error") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 lg:px-5">
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          Impossible de charger la fiche client : {result.error}
          <span className="mt-1 block text-[12px] text-red-700">
            Vérifiez que la migration platform_foundation a bien été exécutée sur
            Supabase.
          </span>
        </div>
      </div>
    );
  }

  return <PlatformClientDetailView detail={result.detail} />;
}
