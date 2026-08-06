import { requireAdminContext } from "@/lib/auth/workspace-context";
import { expenseFiltersSchema } from "@/lib/expenses/schemas";
import { listExpenses } from "@/lib/expenses/queries";
import { ExpensesWorkspace } from "@/components/expenses/expenses-workspace";

type DepensesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DepensesPage({ searchParams }: DepensesPageProps) {
  const workspace = await requireAdminContext();
  const raw = await searchParams;

  const parsed = expenseFiltersSchema.safeParse({
    category: typeof raw.category === "string" ? raw.category : "",
    status: typeof raw.status === "string" ? raw.status : "all",
    search: typeof raw.search === "string" ? raw.search : undefined,
    from: typeof raw.from === "string" ? raw.from : undefined,
    to: typeof raw.to === "string" ? raw.to : undefined,
  });

  const filters = parsed.success ? parsed.data : { status: "all" as const };
  const data = await listExpenses(workspace, filters);

  return (
    <ExpensesWorkspace
      {...data}
      filters={filters}
      establishmentName={workspace.establishmentName}
    />
  );
}
