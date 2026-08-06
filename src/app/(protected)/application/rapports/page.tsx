import { requireAdminContext } from "@/lib/auth/workspace-context";
import { getReportData } from "@/lib/reports/queries";
import { reportFiltersSchema } from "@/lib/reports/schemas";
import { AdminReportsWorkspace } from "@/components/admin/admin-reports-workspace";

type RapportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function defaultPeriod(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

export default async function RapportsPage({ searchParams }: RapportsPageProps) {
  const workspace = await requireAdminContext();
  const raw = await searchParams;

  const hasExplicitPeriod =
    typeof raw.from === "string" || typeof raw.to === "string";

  const parsed = reportFiltersSchema.safeParse({
    from: typeof raw.from === "string" ? raw.from : undefined,
    to: typeof raw.to === "string" ? raw.to : undefined,
  });

  const filters = hasExplicitPeriod
    ? parsed.success
      ? parsed.data
      : {}
    : defaultPeriod();

  const initialReport = await getReportData(workspace, "ventes", filters);

  return (
    <AdminReportsWorkspace
      initialReport={initialReport}
      initialFilters={filters}
      establishmentName={workspace.establishmentName}
    />
  );
}
