import { Suspense } from "react";

import { AdminReportsWorkspace } from "@/components/admin/admin-reports-workspace";
import { PageLoadingShell } from "@/components/layout/page-loading-shell";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { getReportData } from "@/lib/reports/queries";
import type { ReportFiltersInput } from "@/lib/reports/schemas";
import { getEstablishmentSettings } from "@/lib/settings/queries";

type RapportsPageContentProps = {
  workspace: WorkspaceContext;
  filters: ReportFiltersInput;
};

async function RapportsPageContent({
  workspace,
  filters,
}: RapportsPageContentProps) {
  const [initialReport, { settings }] = await Promise.all([
    getReportData(workspace, "ventes", filters),
    getEstablishmentSettings(workspace),
  ]);

  return (
    <AdminReportsWorkspace
      initialReport={initialReport}
      initialFilters={filters}
      establishment={{
        name: settings?.name ?? workspace.establishmentName,
        address: settings?.address ?? null,
        phone: settings?.phone ?? null,
        logoUrl: settings?.logoUrl ?? null,
      }}
      serviceScope={workspace.serviceScope}
      activityCode={workspace.activityCode}
    />
  );
}

export function RapportsPageSuspense(props: RapportsPageContentProps) {
  return (
    <Suspense fallback={<PageLoadingShell label="Chargement des rapports…" />}>
      <RapportsPageContent {...props} />
    </Suspense>
  );
}
