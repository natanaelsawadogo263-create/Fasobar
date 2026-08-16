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
  formatProductUnitDisplay,
} from "@/lib/stock/constants";
import type { CategoryOption, ProductPackaging } from "@/lib/products/types";
import type { StockTab } from "@/lib/stock/schemas";
import type {
  StockListItem,
  StockProductOption,
  StockStats,
  SupplierOption,
} from "@/lib/stock/types";
import { getActivityProfile, isRetailActivity } from "@/lib/activity/profile";
import { isHardwareActivity } from "@/lib/hardware/activity";
import {
  isSingleServiceScope,
  type ServiceScope,
} from "@/lib/settings/service-scope";
import {
  EXPAND_PANEL_CLASS,
  ExpandPanelButton,
  useExpandPanel,
} from "@/components/ui/expand-panel";

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
  activityCode?: string | null;
};

type ModalMode = "entry" | "loss" | "adjust" | "history" | null;

function canManageItem(
  item: StockListItem,
  organizationRole: string,
  establishmentRole: string,
  canManageBarStock: boolean,
  canManageKitchenStock: boolean,
): boolean {
  if (item.departmentCode === "BAR" && canManageBarStock) return true;
  if (item.departmentCode === "KITCHEN" && canManageKitchenStock) return true;
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
  activityCode = null,
}: StockWorkspaceProps) {
  void establishmentName;
  void categories;
  void products;
  void initialTab;
  void canManageBarStock;
  void canManageKitchenStock;
  const router = useRouter();
  const retail = isRetailActivity(activityCode);
  const hardware = isHardwareActivity(activityCode);
  const activity = getActivityProfile(activityCode);
  const singleScope = drinksOnly || isSingleServiceScope(serviceScope) || retail;
  const stockTitle = hardware
    ? "Stock restant"
    : retail
      ? activity.stockNavLabel
      : drinksOnly
        ? "Stock boissons"
        : serviceScope === "KITCHEN"
          ? "Stock nourriture"
          : "Stock";
  const articlesKpiTitle = hardware || retail
    ? "Articles"
    : drinksOnly || serviceScope === "BAR"
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
  const { expanded, toggle: toggleExpanded } = useExpandPanel();

  const isFilteredView =
    Boolean(initialSearch) ||
    Boolean(initialCategoryId) ||
    initialStatus !== "all" ||
    (!drinksOnly && initialTab !== "all");

  const manageableItems = stockItems.filter((item) =>
    canManageItem(
      item,
      organizationRole,
      establishmentRole,
      canManageBarStock,
      canManageKitchenStock,
    ),
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
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5 ${
        retail
          ? "gap-2 lg:py-3"
          : "gap-2 sm:gap-3 lg:gap-3.5 lg:py-4"
      }`}
    >
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[20px] lg:text-[22px]">
            {stockTitle}
          </h1>
          <p className="mt-0.5 hidden text-[12px] text-slate-500 sm:block">
            {drinksOnly || retail ? (
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
            ) : null}
          </p>
          {/* Mobile : alerte compacte sous le titre */}
          <p className="mt-0.5 text-[11px] text-slate-500 sm:hidden">
            {stats.alertCount > 0 ? (
              <span className="font-medium text-orange-600">
                {stats.alertCount} alerte{stats.alertCount > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-emerald-600">Stock stable</span>
            )}
            <span className="text-slate-300"> · </span>
            {stockItems.length} affiché{stockItems.length > 1 ? "s" : ""}
          </p>
        </div>

        {canManageStock ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {drinksOnly ? (
              <button
                type="button"
                onClick={() => openModal("loss")}
                disabled={isPending}
                className="hidden h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:inline-flex"
              >
                <TrendingDown className="h-3.5 w-3.5" />
                Perte
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => openModal("entry")}
              disabled={isPending}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white shadow-sm active:bg-emerald-500 disabled:opacity-60 sm:h-9 sm:hover:bg-emerald-500"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span className="sm:hidden">Entrée</span>
              <span className="hidden sm:inline">Nouvelle entrée</span>
            </button>
          </div>
        ) : null}
      </header>

      {error ? <AlertMessage message={error} /> : null}
      {message ? (
        <AlertMessage
          message={message}
          tone="success"
          onDismiss={() => setMessage(null)}
        />
      ) : null}

      {/* KPI : desktop uniquement — trop serrés sur téléphone */}
      <div
        className={`hidden shrink-0 md:grid ${
          hardware ? "grid-cols-2 gap-2" : retail ? "grid-cols-3 gap-2" : "grid-cols-3 gap-2.5 lg:gap-3"
        }`}
      >
        {hardware ? null : (
        <StatCard
          title={articlesKpiTitle}
          value={articlesKpiValue}
          subtitle={singleScope ? "suivis" : "articles suivis"}
          icon={retail ? Package : Wine}
          tone="sky"
          compact={drinksOnly || retail}
        />
        )}
        <StatCard
          title={drinksOnly ? "Alertes" : retail ? "Alertes" : "Produits en alerte"}
          value={String(stats.alertCount)}
          subtitle={
            drinksOnly || retail ? "faible / rupture" : "stock faible ou rupture"
          }
          icon={AlertTriangle}
          tone="amber"
          compact={drinksOnly || retail}
        />
        <StatCard
          title={drinksOnly || retail ? "Valeur" : "Valeur estimée"}
          value={formatPriceXof(stats.estimatedValue)}
          subtitle={drinksOnly || retail ? "estimée" : "basée sur derniers coûts"}
          icon={drinksOnly || retail ? Wallet : Package}
          tone="emerald"
          compact={drinksOnly || retail}
        />
      </div>

      <section
        className={
          expanded
            ? EXPAND_PANEL_CLASS
            : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80"
        }
      >
        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100 px-3 py-2 sm:px-3.5 sm:py-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-slate-900">
              {drinksOnly ? "Inventaire" : "Articles en stock"}
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
              {stockItems.length}
            </span>
            <div className="ml-auto">
              <ExpandPanelButton expanded={expanded} onToggle={toggleExpanded} />
            </div>
          </div>

          <div className="relative">
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
              placeholder="Rechercher un produit…"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15 sm:h-8 sm:text-[12px]"
            />
          </div>

          <div className="-mx-0.5 flex items-center gap-1 overflow-x-auto px-0.5 pb-0.5">
            {statusFilters.map((filter) => {
              const active = initialStatus === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => pushFilters({ status: filter.id })}
                  className={`inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-[12px] font-semibold transition sm:h-7 sm:rounded-md sm:px-2.5 sm:text-[11px] ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600 active:bg-slate-200"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="app-scroll min-h-0 flex-1 overflow-auto">
          <div className="space-y-1.5 p-2 md:hidden">
            {stockItems.length === 0 ? (
              <StockEmptyState
                canManage={canManageStock && !drinksOnly}
                filtered={totalStockItemCount > 0 && isFilteredView}
                drinksOnly={drinksOnly}
                retail={retail}
              />
            ) : (
              stockItems.map((item) => {
                const itemManageable = canManageItem(
                  item,
                  organizationRole,
                  establishmentRole,
                  canManageBarStock,
                  canManageKitchenStock,
                );
                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-semibold text-slate-900">
                            {item.name}
                          </p>
                          <StockStatusBadge status={item.status} />
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {formatQuantity(item.currentQuantity, item.unit, item.stockUnitLabel)}
                          <span className="text-slate-300"> · </span>
                          min {formatQuantity(item.minimumQuantity, item.unit, item.stockUnitLabel)}
                          {item.categoryName ? (
                            <>
                              <span className="text-slate-300"> · </span>
                              {item.categoryName}
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    {canManageStock ? (
                      <div className="mt-2 flex gap-1">
                        {itemManageable ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openModal("entry", item)}
                              className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 active:bg-slate-50"
                            >
                              <ArrowDownToLine className="h-3.5 w-3.5" />
                              Entrée
                            </button>
                            <button
                              type="button"
                              onClick={() => openModal("loss", item)}
                              className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 active:bg-slate-50"
                            >
                              <TrendingDown className="h-3.5 w-3.5" />
                              Perte
                            </button>
                            <button
                              type="button"
                              onClick={() => openModal("adjust", item)}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-50"
                              title="Corriger"
                              aria-label="Corriger"
                            >
                              <Scale className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openModal("history", item)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-50"
                          title="Historique"
                          aria-label="Historique"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>

          <table className="hidden min-w-full text-left text-[12px] md:table">
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
                      retail={retail}
                    />
                  </td>
                </tr>
              ) : (
                stockItems.map((item) => {
                  const itemManageable = canManageItem(
                    item,
                    organizationRole,
                    establishmentRole,
                    canManageBarStock,
                    canManageKitchenStock,
                  );
                  const unitLabel = formatProductUnitDisplay(
                    item.unit,
                    item.stockUnitLabel,
                  );

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
                        {formatQuantity(item.currentQuantity, item.unit, item.stockUnitLabel)}
                      </td>
                      <td className="px-3.5 py-2.5 tabular-nums text-slate-600">
                        {formatQuantity(item.minimumQuantity, item.unit, item.stockUnitLabel)}
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
          simpleEntry={retail}
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
  icon?: React.ComponentType<{ className?: string }>;
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
          {Icon ? (
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
          ) : null}
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
        {Icon ? (
          <span
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
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
          ? "h-8 w-8"
          : "h-8 gap-1 px-2 text-[11px] font-medium"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {!compact ? <span className="hidden xl:inline">{label}</span> : null}
    </button>
  );
}
