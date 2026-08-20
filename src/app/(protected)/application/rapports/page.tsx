import { RapportsPageSuspense } from "@/app/(protected)/application/rapports/rapports-page-content";
import { requireAdminContext } from "@/lib/auth/workspace-context";
import { reportFiltersSchema } from "@/lib/reports/schemas";

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
  const [workspace, raw] = await Promise.all([
    requireAdminContext(),
    searchParams,
  ]);

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

  return <RapportsPageSuspense workspace={workspace} filters={filters} />;
}
