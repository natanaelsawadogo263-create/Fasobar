import { Suspense } from "react";

import { ExpensesWorkspace } from "@/components/expenses/expenses-workspace";
import { PageLoadingShell } from "@/components/layout/page-loading-shell";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type { ExpenseArea, ExpenseFiltersInput } from "@/lib/expenses/schemas";
import { listExpenseCustomCategories, listExpenses } from "@/lib/expenses/queries";

type DepensesPageContentProps = {
  workspace: WorkspaceContext;
  filters: ExpenseFiltersInput;
  lockedArea: ExpenseArea | null;
  periodFilter: "day" | "week" | "month" | "custom";
  periodLabel: string;
};

async function DepensesPageContent({
  workspace,
  filters,
  lockedArea,
  periodFilter,
  periodLabel,
}: DepensesPageContentProps) {
  const [data, customCategories] = await Promise.all([
    listExpenses(workspace, filters),
    workspace.userSpace === "admin"
      ? listExpenseCustomCategories(workspace)
      : Promise.resolve([]),
  ]);

  return (
    <ExpensesWorkspace
      {...data}
      customCategories={customCategories}
      canManageCategories={workspace.userSpace === "admin"}
      filters={filters}
      establishmentName={workspace.establishmentName}
      lockedArea={lockedArea}
      periodFilter={periodFilter}
      periodLabel={periodLabel}
      canManage
      serviceScope={workspace.serviceScope}
      activityCode={workspace.activityCode}
    />
  );
}

export function DepensesPageSuspense(props: DepensesPageContentProps) {
  return (
    <Suspense fallback={<PageLoadingShell label="Chargement des dépenses…" />}>
      <DepensesPageContent {...props} />
    </Suspense>
  );
}
