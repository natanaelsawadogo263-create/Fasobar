import { requireAdminContext } from "@/lib/auth/workspace-context";
import { adminOrderFiltersSchema } from "@/lib/orders/schemas";
import { listAdminOrders, listOrderCashiers } from "@/lib/orders/queries";
import { AdminOrdersWorkspace } from "@/components/admin/admin-orders-workspace";

type CommandesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommandesPage({ searchParams }: CommandesPageProps) {
  const workspace = await requireAdminContext();
  const raw = await searchParams;

  const parsed = adminOrderFiltersSchema.safeParse({
    status: typeof raw.status === "string" ? raw.status : "all",
    department: typeof raw.department === "string" ? raw.department : "all",
    cashierId: typeof raw.cashierId === "string" ? raw.cashierId : undefined,
    from: typeof raw.from === "string" ? raw.from : undefined,
    to: typeof raw.to === "string" ? raw.to : undefined,
    search: typeof raw.search === "string" ? raw.search : undefined,
  });

  const filters = parsed.success
    ? parsed.data
    : { status: "all" as const, department: "all" as const };

  const [data, cashiers] = await Promise.all([
    listAdminOrders(workspace, filters),
    listOrderCashiers(workspace),
  ]);

  return (
    <AdminOrdersWorkspace
      {...data}
      filters={filters}
      cashiers={cashiers}
      establishmentName={workspace.establishmentName}
      canManageOrders={workspace.canManageOrders}
    />
  );
}
