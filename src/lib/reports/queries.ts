import "server-only";

import { getActivityPages } from "@/lib/activity/pages";
import { isRetailActivity } from "@/lib/activity/profile";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { listAdminCashSessions } from "@/lib/admin/cash-sessions-queries";
import { EXPENSE_AREA_LABELS, EXPENSE_CATEGORY_LABELS } from "@/lib/expenses/constants";
import { listExpenses } from "@/lib/expenses/queries";
import { formatOrderNumber, formatPriceXof } from "@/lib/orders/constants";
import { listAdminOrders } from "@/lib/orders/queries";
import { ORDER_PAYMENT_STATUS_LABELS, ORDER_STATUS_LABELS } from "@/lib/orders/constants";
import { humanizeActionCode, humanizeEntityType, REPORT_TYPE_OPTIONS } from "@/lib/reports/constants";
import type { ReportFiltersInput, ReportType } from "@/lib/reports/schemas";
import type { ReportColumn, ReportMeta, ReportResult, ReportRow, ReportSummaryItem } from "@/lib/reports/types";
import { getAdminSalesData } from "@/lib/sales/queries";
import { sumSoldGoodsCost } from "@/lib/profit/cost-of-goods";
import { listSaleOrderSurpluses } from "@/lib/profit/sale-surplus";
import {
  hasEstablishmentSupplyHistory,
  isProfitReady,
} from "@/lib/profit/supply-history";
import {
  hasBarService,
  hasKitchenService,
} from "@/lib/settings/service-scope";
import { listRecentSupplyEntries, listStockLossEntries, listStockItems } from "@/lib/stock/queries";
import { STOCK_STATUS_LABELS } from "@/lib/stock/constants";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function findTypeMeta(type: ReportType) {
  return (
    REPORT_TYPE_OPTIONS.find((option) => option.id === type) ?? {
      label: type,
      description: "",
    }
  );
}

function buildResult(
  type: ReportType,
  columns: ReportColumn[],
  rows: ReportRow[],
  summary: ReportSummaryItem[] = [],
  meta?: ReportMeta,
): ReportResult {
  const typeMeta = findTypeMeta(type);
  return {
    type,
    title: typeMeta.label,
    description: typeMeta.description,
    columns,
    rows,
    summary,
    meta,
  };
}

async function buildVentesReport(
  workspace: WorkspaceContext,
  filters: ReportFiltersInput,
): Promise<ReportResult> {
  const data = await getAdminSalesData(workspace, { from: filters.from, to: filters.to });

  const retail = isRetailActivity(workspace.activityCode);
  const pages = getActivityPages(workspace.activityCode);

  const rows: ReportRow[] = data.orders.map((order) => ({
    orderNumber: formatOrderNumber(order.orderNumber),
    paidAt: order.paidAt,
    cashierName: order.cashierName ?? "—",
    itemCount: order.itemCount,
    totalAmount: order.totalAmount,
  }));

  return buildResult(
    "ventes",
    [
      { key: "orderNumber", label: retail ? "N° ticket" : "N° commande" },
      { key: "paidAt", label: "Date de paiement", format: "datetime" },
      { key: "cashierName", label: pages.sales.cashierColumn },
      { key: "itemCount", label: retail ? "Produits" : "Articles", format: "number" },
      { key: "totalAmount", label: "Montant", format: "currency" },
    ],
    rows,
    [
      { label: "Chiffre d'affaires", value: formatPriceXof(data.summary.totalRevenue) },
      ...(!isRetailActivity(workspace.activityCode) && hasBarService(workspace.serviceScope)
        ? [{ label: "CA Bar", value: formatPriceXof(data.summary.barRevenue) }]
        : []),
      ...(!isRetailActivity(workspace.activityCode) &&
      hasKitchenService(workspace.serviceScope)
        ? [{ label: "CA Cuisine", value: formatPriceXof(data.summary.kitchenRevenue) }]
        : []),
      { label: "Commandes payées", value: String(data.summary.paidOrderCount) },
    ],
  );
}

async function buildCommandesReport(
  workspace: WorkspaceContext,
  filters: ReportFiltersInput,
): Promise<ReportResult> {
  const data = await listAdminOrders(workspace, {
    status: "all",
    department: "all",
    period: "all",
    from: filters.from,
    to: filters.to,
  });

  const rows: ReportRow[] = data.orders.map((order) => ({
    orderNumber: formatOrderNumber(order.orderNumber),
    createdAt: order.createdAt,
    createdByName: order.createdByName ?? "—",
    status: ORDER_STATUS_LABELS[order.status] ?? order.status,
    paymentStatus: ORDER_PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus,
    itemCount: order.itemCount,
    totalAmount: order.totalAmount,
  }));

  return buildResult(
    "commandes",
    [
      { key: "orderNumber", label: "N° commande" },
      { key: "createdAt", label: "Créée le", format: "datetime" },
      { key: "createdByName", label: "Caissier·ère" },
      { key: "status", label: "Statut" },
      { key: "paymentStatus", label: "Paiement" },
      { key: "itemCount", label: "Articles", format: "number" },
      { key: "totalAmount", label: "Montant", format: "currency" },
    ],
    rows,
    [
      { label: "Total commandes", value: String(data.totalOrders) },
      { label: "Payées", value: String(data.paidCount) },
      { label: "Annulées", value: String(data.cancelledCount) },
    ],
  );
}

async function buildProduitsVendusReport(
  workspace: WorkspaceContext,
  filters: ReportFiltersInput,
): Promise<ReportResult> {
  const data = await getAdminSalesData(workspace, { from: filters.from, to: filters.to });

  const retail = isRetailActivity(workspace.activityCode);
  const pages = getActivityPages(workspace.activityCode);

  const rows: ReportRow[] = data.topProducts.map((product) => ({
    name: product.name,
    departmentName: product.departmentName,
    quantity: product.quantity,
    revenue: product.revenue,
  }));

  return buildResult(
    "produits_vendus",
    [
      { key: "name", label: pages.sales.productColumn },
      ...(!retail
        ? [{ key: "departmentName", label: "Département" } as ReportColumn]
        : []),
      { key: "quantity", label: "Quantité", format: "number" },
      { key: "revenue", label: "Chiffre d'affaires", format: "currency" },
    ],
    rows,
    [{ label: "Produits distincts vendus", value: String(data.topProducts.length) }],
  );
}

async function buildStockBoissonsReport(workspace: WorkspaceContext): Promise<ReportResult> {
  const retail = isRetailActivity(workspace.activityCode);
  const items = await listStockItems(workspace, { tab: "bar", status: "all" });

  const rows: ReportRow[] = items.map((item) => ({
    name: item.name,
    currentQuantity: item.currentQuantity,
    minimumQuantity: item.minimumQuantity,
    unit: item.unit,
    status: STOCK_STATUS_LABELS[item.status],
  }));

  return buildResult(
    "stock_boissons",
    [
      { key: "name", label: retail ? "Produit" : "Article" },
      { key: "currentQuantity", label: "Quantité", format: "number" },
      { key: "minimumQuantity", label: "Seuil minimum", format: "number" },
      { key: "unit", label: "Unité" },
      { key: "status", label: "Statut" },
    ],
    rows,
    [
      { label: retail ? "Produits suivis" : "Articles suivis", value: String(items.length) },
      {
        label: "En alerte",
        value: String(items.filter((item) => item.status === "low" || item.status === "out").length),
      },
    ],
  );
}

async function buildApprovisionnementsReport(
  workspace: WorkspaceContext,
  filters: ReportFiltersInput,
): Promise<ReportResult> {
  const scope = workspace.serviceScope;
  const entries = (
    await listRecentSupplyEntries(workspace, {
      from: filters.from,
      to: filters.to,
      limit: 2000,
    })
  ).filter((entry) => {
    if (entry.departmentCode === "BAR") return hasBarService(scope);
    if (entry.departmentCode === "KITCHEN") return hasKitchenService(scope);
    return true;
  });

  const rows: ReportRow[] = entries.map((entry) => ({
    createdAt: entry.createdAt,
    stockItemName: entry.stockItemName,
    departmentName: entry.departmentName,
    quantity: entry.quantity,
    unit: entry.unit,
    totalCost: entry.totalCost,
    supplierName: entry.supplierName ?? "—",
    reference: entry.reference ?? "—",
  }));

  const barCost = entries
    .filter((entry) => entry.departmentCode === "BAR")
    .reduce((sum, entry) => sum + (entry.totalCost ?? 0), 0);
  const kitchenCost = entries
    .filter((entry) => entry.departmentCode === "KITCHEN")
    .reduce((sum, entry) => sum + (entry.totalCost ?? 0), 0);
  const totalCost = entries.reduce((sum, entry) => sum + (entry.totalCost ?? 0), 0);

  const retail = isRetailActivity(workspace.activityCode);
  const columns: ReportColumn[] = [
    { key: "createdAt", label: "Date", format: "datetime" },
    { key: "stockItemName", label: "Article" },
    ...(!retail ? [{ key: "departmentName", label: "Département" } as ReportColumn] : []),
    { key: "quantity", label: "Quantité", format: "number" },
    { key: "unit", label: "Unité" },
    { key: "totalCost", label: "Coût total", format: "currency" },
    { key: "supplierName", label: "Fournisseur" },
    { key: "reference", label: "Référence" },
  ];

  return buildResult(
    "approvisionnements",
    columns,
    rows,
    [
      { label: "Entrées", value: String(entries.length) },
      { label: "Coût total", value: formatPriceXof(totalCost) },
      ...(!isRetailActivity(workspace.activityCode) && hasBarService(workspace.serviceScope)
        ? [{ label: "Appro Bar", value: formatPriceXof(barCost) }]
        : []),
      ...(!isRetailActivity(workspace.activityCode) &&
      hasKitchenService(workspace.serviceScope)
        ? [{ label: "Appro Cuisine", value: formatPriceXof(kitchenCost) }]
        : []),
    ],
  );
}

async function buildPertesCasseReport(
  workspace: WorkspaceContext,
  filters: ReportFiltersInput,
): Promise<ReportResult> {
  const entries = await listStockLossEntries(workspace, { from: filters.from, to: filters.to });

  const typeLabels: Record<string, string> = {
    LOSS: "Perte",
    BREAKAGE: "Casse",
    STAFF_CONSUMPTION: "Consommation personnel",
    GIFT: "Offert / cadeau",
  };

  const rows: ReportRow[] = entries.map((entry) => ({
    createdAt: entry.createdAt,
    stockItemName: entry.stockItemName,
    departmentName: entry.departmentName,
    type: typeLabels[entry.type] ?? entry.type,
    quantity: entry.quantity,
    unit: entry.unit,
    reason: entry.reason ?? "—",
    createdByName: entry.createdByName ?? "—",
  }));

  return buildResult(
    "pertes_casse",
    [
      { key: "createdAt", label: "Date", format: "datetime" },
      { key: "stockItemName", label: "Article" },
      { key: "departmentName", label: "Département" },
      { key: "type", label: "Type" },
      { key: "quantity", label: "Quantité", format: "number" },
      { key: "unit", label: "Unité" },
      { key: "reason", label: "Motif" },
      { key: "createdByName", label: "Auteur" },
    ],
    rows,
    [{ label: "Mouvements", value: String(entries.length) }],
  );
}

async function buildDepensesReport(
  workspace: WorkspaceContext,
  filters: ReportFiltersInput,
): Promise<ReportResult> {
  const data = await listExpenses(
    workspace,
    {
      status: "all",
      from: filters.from,
      to: filters.to,
    },
    { limit: 2000 },
  );

  const retail = isRetailActivity(workspace.activityCode);

  const rows: ReportRow[] = data.expenses.map((expense) => ({
    expenseDate: expense.expenseDate,
    area: EXPENSE_AREA_LABELS[expense.area],
    category: EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category,
    label: expense.label,
    amount: expense.amount,
    status: expense.status === "CANCELLED" ? "Annulée" : "Enregistrée",
    createdByName: expense.createdByName ?? "—",
  }));

  return buildResult(
    "depenses",
    [
      { key: "expenseDate", label: "Date", format: "date" },
      ...(!retail ? [{ key: "area", label: "Espace" } as const] : []),
      { key: "category", label: "Catégorie" },
      { key: "label", label: "Titre" },
      { key: "amount", label: "Montant", format: "currency" },
      { key: "status", label: "Statut" },
      { key: "createdByName", label: "Auteur" },
    ],
    rows,
    [
      { label: "Total actives", value: formatPriceXof(data.periodTotal) },
      ...(!retail
        ? [
            { label: "Dépenses Bar", value: formatPriceXof(data.barTotal) },
            { label: "Dépenses Caisse", value: formatPriceXof(data.caisseTotal) },
          ]
        : []),
      { label: "Lignes", value: String(data.expenses.length) },
    ],
  );
}

/** @deprecated Conservé pour compat — délègue au rapport Dépenses. */
async function buildDepensesCuisineReport(
  workspace: WorkspaceContext,
  filters: ReportFiltersInput,
): Promise<ReportResult> {
  return buildDepensesReport(workspace, filters);
}

async function buildBeneficesReport(
  workspace: WorkspaceContext,
  filters: ReportFiltersInput,
): Promise<ReportResult> {
  const retail = isRetailActivity(workspace.activityCode);
  const scope = workspace.serviceScope;
  const includeBar = !retail && hasBarService(scope);
  const includeKitchen = !retail && hasKitchenService(scope);

  const [sales, expenses, hasSupplyCost] = await Promise.all([
    getAdminSalesData(workspace, { from: filters.from, to: filters.to }),
    listExpenses(
      workspace,
      {
        status: "RECORDED",
        from: filters.from,
        to: filters.to,
      },
      { limit: 2000 },
    ),
    hasEstablishmentSupplyHistory(workspace),
  ]);

  const orderIds = sales.orders.map((order) => order.id);
  const hasSales = orderIds.length > 0;
  const profitAvailable = isProfitReady({ hasSales, hasSupplyCost });

  const [totalCogs, barCogs, kitchenCogs, saleSurpluses] = await Promise.all([
    hasSales
      ? sumSoldGoodsCost(workspace.establishmentId, orderIds)
      : Promise.resolve(0),
    includeBar && hasSales
      ? sumSoldGoodsCost(workspace.establishmentId, orderIds, { departmentCode: "BAR" })
      : Promise.resolve(0),
    includeKitchen && hasSales
      ? sumSoldGoodsCost(workspace.establishmentId, orderIds, {
          departmentCode: "KITCHEN",
        })
      : Promise.resolve(0),
    hasSales
      ? listSaleOrderSurpluses(
          workspace.establishmentId,
          sales.orders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            paidAt: order.paidAt,
            cashierName: order.cashierName,
          })),
        )
      : Promise.resolve([]),
  ]);

  const beneficeColumns: ReportColumn[] = [
    { key: "space", label: "Espace" },
    { key: "revenue", label: "Chiffre d'affaires", format: "currency" },
    { key: "supplyCost", label: "Coût appro. vendu", format: "currency" },
    { key: "expenses", label: "Dépenses", format: "currency" },
    { key: "profit", label: "Bénéfice", format: "currency" },
  ];

  const meta: ReportMeta = { profitAvailable, saleSurpluses };

  if (retail) {
    const totalRevenue = sales.summary.totalRevenue;
    const totalExpenses = expenses.periodTotal;
    // Bénéfice = ventes − coût d’achat des produits vendus (pas les dépenses).
    const totalProfit = totalRevenue - totalCogs;

    return buildResult(
      "benefices",
      beneficeColumns,
      [
        {
          space: "Total",
          revenue: totalRevenue,
          supplyCost: totalCogs,
          expenses: totalExpenses,
          profit: profitAvailable ? totalProfit : null,
        },
      ],
      [
        ...(profitAvailable
          ? [{ label: "Bénéfice total", value: formatPriceXof(totalProfit) }]
          : []),
        { label: "CA total", value: formatPriceXof(totalRevenue) },
        { label: "Coût appro. vendu", value: formatPriceXof(totalCogs) },
        { label: "Dépenses total", value: formatPriceXof(totalExpenses) },
      ],
      meta,
    );
  }

  const barRevenue = includeBar ? sales.summary.barRevenue : 0;
  const kitchenRevenue = includeKitchen ? sales.summary.kitchenRevenue : 0;
  const barExpenses = includeBar ? expenses.barTotal : 0;
  const kitchenExpenses = includeKitchen ? expenses.caisseTotal : 0;

  const barProfit = barRevenue - barCogs;
  const kitchenProfit = kitchenRevenue - kitchenCogs;
  const totalProfit =
    (includeBar ? barProfit : 0) + (includeKitchen ? kitchenProfit : 0);
  const totalRevenue = barRevenue + kitchenRevenue;
  const totalCogsCombined = barCogs + kitchenCogs;
  const totalExpenses = barExpenses + kitchenExpenses;

  const rows: ReportRow[] = [];
  if (includeBar) {
    rows.push({
      space: "Bar",
      revenue: barRevenue,
      supplyCost: barCogs,
      expenses: barExpenses,
      profit: profitAvailable ? barProfit : null,
    });
  }
  if (includeKitchen) {
    rows.push({
      space: "Cuisine",
      revenue: kitchenRevenue,
      supplyCost: kitchenCogs,
      expenses: kitchenExpenses,
      profit: profitAvailable ? kitchenProfit : null,
    });
  }
  rows.push({
    space: "Total",
    revenue: totalRevenue,
    supplyCost: totalCogsCombined,
    expenses: totalExpenses,
    profit: profitAvailable ? totalProfit : null,
  });

  return buildResult(
    "benefices",
    beneficeColumns,
    rows,
    [
      ...(profitAvailable
        ? [{ label: "Bénéfice total", value: formatPriceXof(totalProfit) }]
        : []),
      { label: "CA total", value: formatPriceXof(totalRevenue) },
      { label: "Coût appro. vendu", value: formatPriceXof(totalCogsCombined) },
      { label: "Dépenses total", value: formatPriceXof(totalExpenses) },
    ],
    meta,
  );
}

function withinPeriod(iso: string | null, from?: string, to?: string): boolean {
  if (!iso) return false;
  if (from && iso < `${from}T00:00:00.000Z`) return false;
  if (to && iso > `${to}T23:59:59.999Z`) return false;
  return true;
}

async function buildSessionsCaisseReport(
  workspace: WorkspaceContext,
  filters: ReportFiltersInput,
  onlyDifferences: boolean,
): Promise<ReportResult> {
  const data = await listAdminCashSessions(workspace);

  const sessions = data.sessions.filter((session) => withinPeriod(session.openedAt, filters.from, filters.to));

  const filtered = onlyDifferences
    ? sessions.filter(
        (session) => session.status === "CLOSED" && session.cashDifference !== null && session.cashDifference !== 0,
      )
    : sessions;

  const statusLabels: Record<string, string> = { OPEN: "Ouverte", CLOSED: "Fermée", CANCELLED: "Annulée" };

  const rows: ReportRow[] = filtered.map((session) => ({
    cashierName: session.cashierName,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    openingCashAmount: session.openingCashAmount,
    cashCollected: session.cashCollected,
    expectedCashAmount: session.expectedCashAmount,
    countedCashAmount: session.countedCashAmount,
    cashDifference: session.cashDifference,
    status: statusLabels[session.status] ?? session.status,
  }));

  const columns: ReportColumn[] = onlyDifferences
    ? [
        { key: "cashierName", label: "Caissier·ère" },
        { key: "closedAt", label: "Fermée le", format: "datetime" },
        { key: "expectedCashAmount", label: "Attendu", format: "currency" },
        { key: "countedCashAmount", label: "Compté", format: "currency" },
        { key: "cashDifference", label: "Écart", format: "currency" },
      ]
    : [
        { key: "cashierName", label: "Caissier·ère" },
        { key: "openedAt", label: "Ouverte le", format: "datetime" },
        { key: "closedAt", label: "Fermée le", format: "datetime" },
        { key: "openingCashAmount", label: "Fond initial", format: "currency" },
        { key: "cashCollected", label: "Espèces encaissées", format: "currency" },
        { key: "expectedCashAmount", label: "Attendu", format: "currency" },
        { key: "countedCashAmount", label: "Compté", format: "currency" },
        { key: "cashDifference", label: "Écart", format: "currency" },
        { key: "status", label: "Statut" },
      ];

  return buildResult(
    onlyDifferences ? "ecarts_caisse" : "sessions_caisse",
    columns,
    rows,
    onlyDifferences
      ? [{ label: "Sessions avec écart", value: String(filtered.length) }]
      : [
          { label: "Sessions", value: String(filtered.length) },
          { label: "Espèces encaissées (total)", value: String(data.totalCashCollected) },
        ],
  );
}

type AuditLogRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

async function buildActiviteUtilisateursReport(
  workspace: WorkspaceContext,
  filters: ReportFiltersInput,
): Promise<ReportResult> {
  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("id, entity_type, entity_id, action, metadata, created_at, profiles(full_name)")
    .eq("organization_id", workspace.organizationId).eq("establishment_id", workspace.establishmentId)
    .eq("organization_id", workspace.organizationId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (filters.from) {
    query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
  }

  if (filters.to) {
    query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;

  if (error || !data) {
    return buildResult(
      "activite_utilisateurs",
      [
        { key: "createdAt", label: "Date", format: "datetime" },
        { key: "actorName", label: "Utilisateur" },
        { key: "action", label: "Action" },
        { key: "entityType", label: "Entité" },
      ],
      [],
      [{ label: "Événements", value: "0" }],
    );
  }

  const rows: ReportRow[] = (data as unknown as AuditLogRow[]).map((row) => {
    const profile = readSingle(row.profiles);
    return {
      createdAt: row.created_at,
      actorName: profile?.full_name ?? "—",
      action: humanizeActionCode(row.action),
      entityType: humanizeEntityType(row.entity_type, row.action),
    };
  });

  return buildResult(
    "activite_utilisateurs",
    [
      { key: "createdAt", label: "Date", format: "datetime" },
      { key: "actorName", label: "Utilisateur" },
      { key: "action", label: "Action" },
      { key: "entityType", label: "Entité" },
    ],
    rows,
    [{ label: "Événements", value: String(rows.length) }],
  );
}

/**
 * Calcule un rapport Admin à partir des mêmes requêtes que les autres écrans
 * (ventes, commandes, stock, dépenses, caisse, audit) — aucune donnée fictive.
 */
export async function getReportData(
  workspace: WorkspaceContext,
  type: ReportType,
  filters: ReportFiltersInput = {},
): Promise<ReportResult> {
  if (
    type === "stock_boissons" &&
    !isRetailActivity(workspace.activityCode) &&
    !hasBarService(workspace.serviceScope)
  ) {
    return buildVentesReport(workspace, filters);
  }

  switch (type) {
    case "ventes":
      return buildVentesReport(workspace, filters);
    case "commandes":
      return buildCommandesReport(workspace, filters);
    case "produits_vendus":
      return buildProduitsVendusReport(workspace, filters);
    case "stock_boissons":
      return buildStockBoissonsReport(workspace);
    case "approvisionnements":
      return buildApprovisionnementsReport(workspace, filters);
    case "pertes_casse":
      return buildPertesCasseReport(workspace, filters);
    case "depenses":
      return buildDepensesReport(workspace, filters);
    case "depenses_cuisine":
      return buildDepensesCuisineReport(workspace, filters);
    case "benefices":
      return buildBeneficesReport(workspace, filters);
    case "sessions_caisse":
      return buildSessionsCaisseReport(workspace, filters, false);
    case "ecarts_caisse":
      return buildSessionsCaisseReport(workspace, filters, true);
    case "activite_utilisateurs":
      return buildActiviteUtilisateursReport(workspace, filters);
    default:
      return buildResult(type, [], []);
  }
}
