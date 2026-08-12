"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  History,
  Package,
  Scale,
  Search,
  TrendingDown,
  Wallet,
  Wine,
} from "lucide-react";

import {
  adjustStockQuantityAction,
  recordStockEntryAction,
  recordStockLossAction,
} from "@/app/(protected)/application/stock/actions";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { AlertMessage } from "@/components/auth/alert-message";
import { StockAdjustmentModal } from "@/components/stock/stock-adjustment-modal";
import { StockEmptyState } from "@/components/stock/stock-empty-state";
import { StockEntryModal } from "@/components/stock/stock-entry-modal";
import { StockHistoryModal } from "@/components/stock/stock-history-modal";
import { StockLossModal } from "@/components/stock/stock-loss-modal";
import { StockStatusBadge } from "@/components/stock/stock-status-badge";
import {
  canManageDepartmentStock,
  formatPriceXof,
  formatQuantity,
  PRODUCT_UNIT_LABELS,
} from "@/lib/stock/constants";
import type { CategoryOption, ProductPackaging } from "@/lib/products/types";
import type { StockTab } from "@/lib/stock/schemas";
import type {
  StockListItem,
  StockProductOption,
  StockStats,
  SupplierOption,
} from "@/lib/stock/types";
import {
  isSingleServiceScope,
  type ServiceScope,
} from "@/lib/settings/service-scope";

type StockWorkspaceProps = {
  establishmentName: string;
  stockItems: StockListItem[];
  suppliers: SupplierOption[];
  categories: CategoryOption[];
  products: StockProductOption[];
  stats: StockStats;
  packagingsByProduct?: Record<string, ProductPackaging[]>;
  initialTab: StockTab;
  initialSearch: string;
  initialCategoryId: string;
  initialStatus: string;
  canManageStock: boolean;
  canManageBarStock: boolean;
  canManageKitchenStock: boolean;
  organizationRole: string;
  establishmentRole: string;
  totalStockItemCount: number;
  basePath?: string;
  /** Espace responsable bar : boissons uniquement (même UI que l'admin stock). */
  drinksOnly?: boolean;
  serviceScope?: ServiceScope;
};

type ModalMode = "entry" | "loss" | "adjust" | "history" | null;

function canManageItem(
  item: StockListItem,
  organizationRole: string,
  establishmentRole: string,
): boolean {
  return canManageDepartmentStock(
    organizationRole,
    establishmentRole,
    item.departmentCode as "BAR" | "KITCHEN",
  );
}

export function StockWorkspace({
  establishmentName,
  stockItems,
  suppliers,
  categories,
  products,
  stats,
  packagingsByProduct = {},
  initialTab,
  initialSearch,
  initialCategoryId,
  initialStatus,
  canManageStock,
  canManageBarStock,
  canManageKitchenStock,
  organizationRole,
  establishmentRole,
  totalStockItemCount,
  basePath = "/application/stock",
  drinksOnly = false,
  serviceScope = "BOTH",
}: StockWorkspaceProps) {
  void categories;
  void products;
  void initialTab;
  void canManageBarStock;
  void canManageKitchenStock;
  const router = useRouter();
  const singleScope = drinksOnly || isSingleServiceScope(serviceScope);
  const stockTitle = drinksOnly
    ? "Stock boissons"
    : serviceScope === "KITCHEN"
      ? "Stock nourriture"
      : "Stock";
  const articlesKpiTitle =
    drinksOnly || serviceScope === "BAR"
      ? "Articles"
      : serviceScope === "KITCHEN"
        ? "Articles"
        : "Stock boissons";
  const articlesKpiValue =
    drinksOnly || serviceScope === "BAR"
      ? String(stats.barItemCount)
      : serviceScope === "KITCHEN"
        ? String(stats.kitchenItemCount)
        : String(stats.barItemCount);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedItem, setSelectedItem] = useState<StockListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(initialSearch);

  const isFilteredView =
    Boolean(initialSearch) ||
    Boolean(initialCategoryId) ||
    initialStatus !== "all" ||
    (!drinksOnly && initialTab !== "all");

  const manageableItems = stockItems.filter((item) =>
    canManageItem(item, organizationRole, establishmentRole),
  );

  const tableColSpan = canManageStock
    ? singleScope
      ? 5
      : 7
    : singleScope
      ? 4
      : 6;

  function openModal(mode: ModalMode, item?: StockListItem) {
    setModalMode(mode);
    setSelectedItem(item ?? null);
    setFormError(null);
    setError(null);
    setMessage(null);
  }

  function closeModal() {
    setModalMode(null);
    setSelectedItem(null);
    setFormError(null);
  }

  function pushFilters(next: { search?: string; status?: string }) {
    const params = new URLSearchParams();
    const search = next.search ?? initialSearch;
    const status = next.status ?? initialStatus;
    if (search.trim()) params.set("search", search.trim());
    if (status && status !== "all") params.set("status", status);
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  async function handleEntrySubmit(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      const result = await recordStockEntryAction({}, formData);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setMessage(result.success ?? "Entrée enregistrée.");
      closeModal();
      refreshSoon(() => router.refresh());
    });
  }

  async function handleLossSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await recordStockLossAction({}, formData);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setMessage(result.success ?? "Perte enregistrée.");
      closeModal();
      refreshSoon(() => router.refresh());
    });
  }

  async function handleAdjustmentSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await adjustStockQuantityAction({}, formData);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setMessage(result.success ?? "Stock corrigé.");
      closeModal();
      refreshSoon(() => router.refresh());
    });
  }

  const statusFilters = [
    { id: "all", label: "Tous" },
    { id: "out", label: "Rupture" },
    { id: "low", label: "Faible" },
    { id: "ok", label: "OK" },
  ] as const;

  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden ${
        drinksOnly
          ? "px-4 py-4 lg:gap-4 lg:px-6 lg:py-5"
          : "gap-3 px-4 py-3 lg:gap-3.5 lg:px-5 lg:py-4"
      }`}
    >
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
            {stockTitle}
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {drinksOnly ? (
              <>
                {totalStockItemCount} article
                {totalStockItemCount > 1 ? "s" : ""} suivi
                {totalStockItemCount > 1 ? "s" : ""}
                {stats.alertCount > 0 ? (
                  <span className="text-orange-600">
                    {" "}
                    · {stats.alertCount} en alerte
                  </span>
                ) : (
                  <span className="text-emerald-600"> · stock stable</span>
                )}
              </>
            ) : (
              <>
                Établissement actif :{" "}
                <span className="font-medium text-slate-700">
                  {establishmentName}
                </span>
              </>
            )}
          </p>
        </div>

        {canManageStock ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {drinksOnly ? (
              <button
                type="button"
                onClick={() => openModal("loss")}
                disabled={isPending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <TrendingDown className="h-3.5 w-3.5" />
                Perte
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => openModal("entry")}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Nouvelle entrée
            </button>
          </div>
        ) : null}
      </header>

      {(error || message) && (
        <div className="shrink-0 space-y-2">
          {error ? <AlertMessage message={error} /> : null}
          {message ? <AlertMessage message={message} tone="success" /> : null}
        </div>
      )}

      <div
        className={`grid shrink-0 gap-2.5 ${
          drinksOnly ? "grid-cols-3 lg:gap-3" : "grid-cols-3 lg:gap-3"
        }`}
      >
        <StatCard
          title={articlesKpiTitle}
          value={articlesKpiValue}
          subtitle={singleScope ? "suivis" : "articles suivis"}
          icon={Wine}
          tone="sky"
          compact={drinksOnly}
        />
        <StatCard
          title={drinksOnly ? "Alertes" : "Produits en alerte"}
          value={String(stats.alertCount)}
          subtitle={drinksOnly ? "faible / rupture" : "stock faible ou rupture"}
          icon={AlertTriangle}
          tone="amber"
          compact={drinksOnly}
        />
        <StatCard
          title={drinksOnly ? "Valeur" : "Valeur estimée"}
          value={formatPriceXof(stats.estimatedValue)}
          subtitle={drinksOnly ? "estimée" : "basée sur derniers coûts"}
          icon={drinksOnly ? Wallet : Package}
          tone="emerald"
          compact={drinksOnly}
        />
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-slate-100 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-slate-900">
              {drinksOnly ? "Inventaire" : "Articles en stock"}
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
              {stockItems.length}
            </span>
          </div>

          {drinksOnly ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:max-w-xl">
              <div className="relative min-w-[140px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      pushFilters({ search: searchDraft });
                    }
                  }}
                  onBlur={() => {
                    if (searchDraft !== initialSearch) {
                      pushFilters({ search: searchDraft });
                    }
                  }}
                  placeholder="Rechercher…"
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-[12px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
                {statusFilters.map((filter) => {
                  const active = initialStatus === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => pushFilters({ status: filter.id })}
                      className={`h-7 rounded-md px-2.5 text-[11px] font-semibold transition ${
                        active
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="app-scroll min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur">
              <tr>
                <th className="px-3.5 py-2.5 font-medium">Produit</th>
                {singleScope ? null : (
                  <th className="px-3.5 py-2.5 font-medium">Département</th>
                )}
                <th className="px-3.5 py-2.5 font-medium">Stock</th>
                <th className="px-3.5 py-2.5 font-medium">Min.</th>
                {!singleScope ? (
                  <th className="px-3.5 py-2.5 font-medium">Unité</th>
                ) : null}
                <th className="px-3.5 py-2.5 font-medium">Statut</th>
                {canManageStock ? (
                  <th className="px-3.5 py-2.5 text-right font-medium">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockItems.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan}>
                    <StockEmptyState
                      canManage={canManageStock && !drinksOnly}
                      filtered={totalStockItemCount > 0 && isFilteredView}
                      drinksOnly={drinksOnly}
                    />
                  </td>
                </tr>
              ) : (
                stockItems.map((item) => {
                  const itemManageable = canManageItem(
                    item,
                    organizationRole,
                    establishmentRole,
                  );
                  const unitLabel =
                    PRODUCT_UNIT_LABELS[
                      item.unit as keyof typeof PRODUCT_UNIT_LABELS
                    ] ?? item.unit;

                  return (
                    <tr
                      key={item.id}
                      className="text-slate-700 hover:bg-slate-50/70"
                    >
                      <td className="px-3.5 py-2.5">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {item.categoryName ? `${item.categoryName} · ` : ""}
                          {unitLabel}
                        </p>
                      </td>
                      {singleScope ? null : (
                        <td className="px-3.5 py-2.5 text-slate-600">
                          {item.departmentName}
                        </td>
                      )}
                      <td className="px-3.5 py-2.5 font-semibold tabular-nums text-slate-900">
                        {formatQuantity(item.currentQuantity, item.unit)}
                      </td>
                      <td className="px-3.5 py-2.5 tabular-nums text-slate-600">
                        {formatQuantity(item.minimumQuantity, item.unit)}
                      </td>
                      {!singleScope ? (
                        <td className="px-3.5 py-2.5 text-slate-600">
                          {unitLabel}
                        </td>
                      ) : null}
                      <td className="px-3.5 py-2.5">
                        <StockStatusBadge status={item.status} />
                      </td>
                      {canManageStock ? (
                        <td className="px-3.5 py-2.5">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {itemManageable ? (
                              <>
                                <ActionButton
                                  icon={ArrowDownToLine}
                                  label="Entrée"
                                  onClick={() => openModal("entry", item)}
                                  compact={drinksOnly}
                                />
                                <ActionButton
                                  icon={TrendingDown}
                                  label="Perte"
                                  onClick={() => openModal("loss", item)}
                                  compact={drinksOnly}
                                />
                                <ActionButton
                                  icon={Scale}
                                  label="Corriger"
                                  onClick={() => openModal("adjust", item)}
                                  compact={drinksOnly}
                                />
                              </>
                            ) : null}
                            <ActionButton
                              icon={History}
                              label="Historique"
                              onClick={() => openModal("history", item)}
                              compact={drinksOnly}
                            />
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalMode === "entry" && canManageStock ? (
        <StockEntryModal
          stockItems={manageableItems.length > 0 ? manageableItems : stockItems}
          suppliers={suppliers}
          packagingsByProduct={packagingsByProduct}
          preselectedItemId={selectedItem?.id}
          formError={formError}
          isPending={isPending}
          drinksOnly={drinksOnly}
          onClose={closeModal}
          onSubmit={handleEntrySubmit}
        />
      ) : null}

      {modalMode === "loss" && canManageStock ? (
        <StockLossModal
          stockItems={manageableItems}
          preselectedItemId={selectedItem?.id}
          formError={formError}
          onClose={closeModal}
          onSubmit={handleLossSubmit}
        />
      ) : null}

      {modalMode === "adjust" && selectedItem && canManageStock ? (
        <StockAdjustmentModal
          stockItem={selectedItem}
          formError={formError}
          onClose={closeModal}
          onSubmit={handleAdjustmentSubmit}
        />
      ) : null}

      {modalMode === "history" && selectedItem ? (
        <StockHistoryModal stockItem={selectedItem} onClose={closeModal} />
      ) : null}
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "amber" | "sky";
  compact?: boolean;
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
  compact = false,
}: StatCardProps) {
  const toneClasses = {
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-orange-50 text-orange-600",
    sky: "bg-sky-50 text-sky-600",
  };

  if (compact) {
    return (
      <article className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/80">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {title}
            </p>
            <p className="truncate text-[15px] font-bold tabular-nums text-slate-900 lg:text-[16px]">
              {value}
            </p>
            <p className="truncate text-[10px] text-slate-400">{subtitle}</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-500">{title}</p>
          <p className="mt-0.5 truncate text-[16px] font-bold tracking-tight tabular-nums text-slate-900 lg:text-[17px]">
            {value}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
        </div>
      </div>
    </article>
  );
}

type ActionButtonProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  compact?: boolean;
};

function ActionButton({
  icon: Icon,
  label,
  onClick,
  compact = false,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 ${
        compact
          ? "h-7 w-7"
          : "h-7 gap-1 px-2 text-[11px] font-medium"
      }`}
    >
      <Icon className="h-3 w-3" />
      {!compact ? <span className="hidden xl:inline">{label}</span> : null}
    </button>
  );
}
