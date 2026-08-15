"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClipboardList, Search } from "lucide-react";

import { cancelOrderAction } from "@/app/(protected)/application/caisse/actions";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { AlertMessage } from "@/components/auth/alert-message";
import { OrderPrepBadges } from "@/components/ops/order-prep-badges";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  EXPAND_PANEL_CLASS,
  ExpandPanelButton,
  useExpandPanel,
} from "@/components/ui/expand-panel";
import { ToggleField } from "@/components/ui/form-controls";
import {
  DEPARTMENT_BADGE_STYLES,
  formatOrderNumber,
  formatPriceXof,
  ORDER_PAYMENT_STATUS_LABELS,
  ORDER_PAYMENT_STATUS_STYLES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
} from "@/lib/orders/constants";
import {
  resolveOrderPeriodRange,
  toLocalIsoDate,
} from "@/lib/orders/period";
import type {
  AdminOrderDepartmentFilter,
  AdminOrderFiltersInput,
  AdminOrderPeriodFilter,
  AdminOrderStatusFilter,
} from "@/lib/orders/schemas";
import type { AdminOrderListItem, OrderCashierOption } from "@/lib/orders/types";
import {
  allowedDepartments,
  isSingleServiceScope,
  type ServiceScope,
} from "@/lib/settings/service-scope";

type AdminOrdersWorkspaceProps = {
  orders: AdminOrderListItem[];
  totalOrders: number;
  openCount: number;
  paidCount: number;
  cancelledCount: number;
  totalRevenue: number;
  filters: AdminOrderFiltersInput;
  periodLabel: string;
  cashiers: OrderCashierOption[];
  establishmentName: string;
  canManageOrders: boolean;
  serviceScope?: ServiceScope;
};

const DEPARTMENT_LABELS: Record<string, string> = {
  BAR: "Boissons",
  KITCHEN: "Cuisine",
};

const PERIOD_OPTIONS: Array<{ id: Exclude<AdminOrderPeriodFilter, "all" | "custom">; label: string }> = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
];

function isCancellable(order: AdminOrderListItem): boolean {
  return order.paymentStatus !== "PAID" && order.status !== "CANCELLED";
}

export function AdminOrdersWorkspace({
  orders,
  totalOrders,
  openCount,
  paidCount,
  cancelledCount: _cancelledCount,
  totalRevenue,
  filters,
  periodLabel: _periodLabel,
  cashiers,
  establishmentName: _establishmentName,
  canManageOrders,
  serviceScope = "BOTH",
}: AdminOrdersWorkspaceProps) {
  void _cancelledCount;
  void _establishmentName;
  void _periodLabel;
  const router = useRouter();
  const departments = allowedDepartments(serviceScope);
  const singleScope = isSingleServiceScope(serviceScope);
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminOrderListItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const { expanded, toggle: toggleExpanded } = useExpandPanel();

  const activePeriod = filters.period ?? "day";

  function applyFilters(
    next: Partial<AdminOrderFiltersInput> & { period?: AdminOrderPeriodFilter },
  ) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.status && merged.status !== "all") params.set("status", merged.status);
    if (merged.department && merged.department !== "all")
      params.set("department", merged.department);
    if (merged.cashierId) params.set("cashierId", merged.cashierId);
    if (merged.search) params.set("search", merged.search);

    const nextPeriod =
      next.period ??
      (next.from !== undefined || next.to !== undefined ? "custom" : activePeriod);

    if (nextPeriod && nextPeriod !== "custom" && nextPeriod !== "all") {
      const range = resolveOrderPeriodRange(nextPeriod, toLocalIsoDate(new Date()));
      params.set("period", nextPeriod);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
    } else {
      params.set("period", nextPeriod === "all" ? "all" : "custom");
      if (merged.from) params.set("from", merged.from);
      if (merged.to) params.set("to", merged.to);
    }

    router.push(`/application/commandes?${params.toString()}`);
  }

  function openCancelModal(order: AdminOrderListItem) {
    setCancelError(null);
    setCancelReason("");
    setCancelConfirmed(false);
    setCancelTarget(order);
  }

  function handleCancelSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const formData = new FormData(event.currentTarget);
      const result = await cancelOrderAction({}, formData);

      if (result.error) {
        setCancelError(result.error);
        return;
      }

      setCancelTarget(null);
      setMessage(result.success ?? "Commande annulée.");
      refreshSoon(() => router.refresh());
    });
  }

  const stats = [
    {
      title: "Total",
      shortTitle: "Total",
      value: String(totalOrders),
      accent: "text-slate-900",
    },
    {
      title: "En cours",
      shortTitle: "En cours",
      value: String(openCount),
      accent: "text-amber-700",
    },
    {
      title: "Terminées",
      shortTitle: "Payées",
      value: String(paidCount),
      accent: "text-emerald-700",
    },
    {
      title: "Chiffre d'affaires",
      shortTitle: "CA",
      value: formatPriceXof(totalRevenue),
      accent: "text-emerald-700",
    },
  ];

  const statusChips: Array<{ id: AdminOrderStatusFilter; label: string }> = [
    { id: "all", label: "Tous" },
    { id: "open", label: "En cours" },
    { id: "paid", label: "Payées" },
    { id: "cancelled", label: "Annulées" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden px-3 py-2.5 sm:gap-2.5 sm:p-3 lg:p-3">
      <header className="shrink-0">
        <h1 className="text-[18px] font-bold leading-none tracking-tight text-slate-900 lg:text-[20px]">
          Commandes
        </h1>
      </header>

      {/* KPI mobile */}
      <div className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-0.5 md:hidden">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="w-[40%] min-w-[8.5rem] shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm"
          >
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {stat.shortTitle}
            </p>
            <p
              className={`pos-tabular mt-1 truncate text-[15px] font-bold leading-none ${stat.accent}`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* KPI desktop */}
      <div className="hidden shrink-0 grid-cols-2 gap-2 md:grid lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {stat.title}
            </p>
            <p
              className={`pos-tabular mt-1 text-[18px] font-bold leading-none tracking-tight ${stat.accent}`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {message ? (
        <div className="shrink-0">
          <AlertMessage
            message={message}
            tone="success"
            onDismiss={() => setMessage(null)}
          />
        </div>
      ) : null}

      {/* Recherche */}
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          defaultValue={filters.search ?? ""}
          placeholder="N°, table, caissière…"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-[14px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 sm:h-9 sm:rounded-lg sm:text-[12px]"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyFilters({ search: (event.target as HTMLInputElement).value });
            }
          }}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value !== (filters.search ?? "").trim()) {
              applyFilters({ search: value });
            }
          }}
        />
      </div>

      {/* Statut chips (mobile) + période */}
      <div className="-mx-3 flex shrink-0 gap-1.5 overflow-x-auto px-3 pb-0.5 md:hidden">
        {statusChips.map((chip) => {
          const isActive = (filters.status || "all") === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => applyFilters({ status: chip.id })}
              className={`inline-flex h-10 shrink-0 items-center rounded-full px-3.5 text-[12px] font-semibold transition ${
                isActive
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 active:bg-slate-50"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <select
          value={filters.status || "all"}
          onChange={(event) =>
            applyFilters({ status: event.target.value as AdminOrderStatusFilter })
          }
          className="hidden h-9 rounded-lg border border-slate-200 bg-white px-2 text-[12px] md:block"
        >
          <option value="all">Tous statuts</option>
          <option value="open">En cours</option>
          <option value="paid">Terminées</option>
          <option value="cancelled">Annulées</option>
        </select>
        {singleScope ? (
          <input type="hidden" name="department" value={departments[0]} />
        ) : (
          <select
            value={filters.department || "all"}
            onChange={(event) =>
              applyFilters({
                department: event.target.value as AdminOrderDepartmentFilter,
              })
            }
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] sm:h-9 sm:flex-none sm:rounded-lg sm:text-[12px]"
          >
            <option value="all">Tous départements</option>
            {departments.includes("BAR") ? (
              <option value="BAR">Boissons</option>
            ) : null}
            {departments.includes("KITCHEN") ? (
              <option value="KITCHEN">Cuisine</option>
            ) : null}
          </select>
        )}
        <select
          value={filters.cashierId || ""}
          onChange={(event) => applyFilters({ cashierId: event.target.value })}
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] sm:h-9 sm:flex-none sm:rounded-lg sm:text-[12px]"
        >
          <option value="">Tous caissiers</option>
          {cashiers.map((cashier) => (
            <option key={cashier.id} value={cashier.id}>
              {cashier.fullName}
            </option>
          ))}
        </select>
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => applyFilters({ period: option.id })}
              className={`inline-flex h-9 shrink-0 items-center rounded-md px-2.5 text-[12px] font-semibold transition sm:h-8 sm:text-[11px] ${
                activePeriod === option.id
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 active:bg-slate-50 sm:hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-500 sm:h-8">
          Du
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(event) => applyFilters({ from: event.target.value })}
            className="h-7 min-w-[8.5rem] border-0 bg-transparent px-0 text-[12px] text-slate-800 outline-none"
          />
        </label>
        <label className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-500 sm:h-8">
          Au
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(event) => applyFilters({ to: event.target.value })}
            className="h-7 min-w-[8.5rem] border-0 bg-transparent px-0 text-[12px] text-slate-800 outline-none"
          />
        </label>
      </div>

      <section
        className={
          expanded
            ? EXPAND_PANEL_CLASS
            : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
        }
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-100 px-3">
          <h2 className="text-[13px] font-semibold text-slate-900">Liste</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
            {orders.length}
          </span>
          <div className="ml-auto">
            <ExpandPanelButton expanded={expanded} onToggle={toggleExpanded} />
          </div>
        </div>
        {orders.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h2 className="mt-3 text-[15px] font-semibold text-slate-900">
              Aucune commande
            </h2>
            <p className="mt-1 max-w-sm text-[12px] text-slate-500">
              Ajustez les filtres pour retrouver les commandes de
              l&apos;établissement.
            </p>
          </div>
        ) : (
          <>
            {/* Cartes mobile */}
            <div className="app-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-2 md:hidden">
              {orders.map((order) => {
                const ref =
                  order.tableReference ?? order.customerReference ?? "—";
                return (
                  <article
                    key={order.id}
                    className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-emerald-700">
                          {formatOrderNumber(order.orderNumber)}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-slate-600">
                          {ref}
                          {order.createdByName
                            ? ` · ${order.createdByName}`
                            : ""}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {new Date(order.createdAt).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {order.itemCount} art.
                        </p>
                      </div>
                      <p className="shrink-0 text-[15px] font-bold tabular-nums text-slate-900">
                        {formatPriceXof(order.totalAmount)}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_STATUS_STYLES[order.status]}`}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_PAYMENT_STATUS_STYLES[order.paymentStatus]}`}
                      >
                        {ORDER_PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </span>
                      {!singleScope
                        ? order.departmentCodes.map((code) => (
                            <span
                              key={code}
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${DEPARTMENT_BADGE_STYLES[code]}`}
                            >
                              {DEPARTMENT_LABELS[code] ?? code}
                            </span>
                          ))
                        : null}
                      <OrderPrepBadges
                        barStatus={order.barStatus}
                        kitchenStatus={order.kitchenStatus}
                      />
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <Link
                        href={`/application/commandes/${order.id}`}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-800 active:bg-slate-100"
                      >
                        Détail
                      </Link>
                      {order.receiptId ? (
                        <Link
                          href={`/application/recus/${order.receiptId}`}
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 text-[13px] font-semibold text-white active:bg-emerald-700"
                        >
                          Reçu
                        </Link>
                      ) : canManageOrders && isCancellable(order) ? (
                        <button
                          type="button"
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-[13px] font-semibold text-red-700 active:bg-red-100"
                          onClick={() => openCancelModal(order)}
                        >
                          Annuler
                        </button>
                      ) : (
                        <span className="inline-flex h-11 items-center justify-center rounded-xl border border-dashed border-slate-200 text-[12px] text-slate-400">
                          —
                        </span>
                      )}
                    </div>
                    {order.receiptId &&
                    canManageOrders &&
                    isCancellable(order) ? (
                      <button
                        type="button"
                        className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 text-[12px] font-semibold text-red-700 active:bg-red-100"
                        onClick={() => openCancelModal(order)}
                      >
                        Annuler la commande
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>

            {/* Table desktop */}
            <div className="hidden h-full overflow-auto md:block">
              <table className="min-w-full text-left text-[12px]">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2.5 py-2 font-semibold">N°</th>
                    <th className="px-2.5 py-2 font-semibold">Table / Réf.</th>
                    {singleScope ? null : (
                      <th className="px-2.5 py-2 font-semibold">Département</th>
                    )}
                    <th className="px-2.5 py-2 font-semibold">Caissier·ère</th>
                    <th className="px-2.5 py-2 font-semibold">Date</th>
                    <th className="px-2.5 py-2 font-semibold">Articles</th>
                    <th className="px-2.5 py-2 font-semibold">Total</th>
                    <th className="px-2.5 py-2 font-semibold">Statut</th>
                    <th className="px-2.5 py-2 font-semibold">Paiement</th>
                    <th className="px-2.5 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-2.5 py-1.5 font-semibold text-emerald-700">
                        {formatOrderNumber(order.orderNumber)}
                      </td>
                      <td className="px-2.5 py-1.5 text-slate-700">
                        {order.tableReference ??
                          order.customerReference ??
                          "—"}
                      </td>
                      {singleScope ? null : (
                        <td className="px-2.5 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {order.departmentCodes.length === 0 ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              order.departmentCodes.map((code) => (
                                <span
                                  key={code}
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${DEPARTMENT_BADGE_STYLES[code]}`}
                                >
                                  {DEPARTMENT_LABELS[code] ?? code}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-2.5 py-1.5 text-slate-600">
                        {order.createdByName ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-600">
                        {new Date(order.createdAt).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-2.5 py-1.5">{order.itemCount}</td>
                      <td className="px-2.5 py-1.5 font-semibold text-slate-900">
                        {formatPriceXof(order.totalAmount)}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_STATUS_STYLES[order.status]}`}
                          >
                            {ORDER_STATUS_LABELS[order.status]}
                          </span>
                          <OrderPrepBadges
                            barStatus={order.barStatus}
                            kitchenStatus={order.kitchenStatus}
                          />
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_PAYMENT_STATUS_STYLES[order.paymentStatus]}`}
                        >
                          {ORDER_PAYMENT_STATUS_LABELS[order.paymentStatus]}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/application/commandes/${order.id}`}
                            className="text-[11px] font-semibold text-slate-700 hover:underline"
                          >
                            Détail
                          </Link>
                          {order.receiptId ? (
                            <Link
                              href={`/application/recus/${order.receiptId}`}
                              className="text-[11px] font-semibold text-emerald-700 hover:underline"
                            >
                              Reçu
                            </Link>
                          ) : null}
                          {canManageOrders && isCancellable(order) ? (
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-red-600 hover:underline"
                              onClick={() => openCancelModal(order)}
                            >
                              Annuler
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {cancelTarget ? (
        <ModalShell
          formId="cancel-admin-order-form"
          title="Annuler la commande"
          subtitle={`${formatOrderNumber(cancelTarget.orderNumber)} — cette action est définitive.`}
          onClose={() => setCancelTarget(null)}
          onSubmit={handleCancelSubmit}
          footer={
            <ModalFooter
              onCancel={() => setCancelTarget(null)}
              submitLabel="Confirmer l'annulation"
              pendingLabel="Annulation..."
            />
          }
        >
          <input type="hidden" name="orderId" value={cancelTarget.id} />
          {cancelError ? (
            <div className="mb-4">
              <AlertMessage message={cancelError} />
            </div>
          ) : null}
          <label htmlFor="reason" className="block text-sm font-medium text-slate-700">
            Motif d&apos;annulation
          </label>
          <textarea
            id="reason"
            name="reason"
            required
            rows={3}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            placeholder="Ex. Erreur de saisie, client parti..."
          />
          <div className="mt-4">
            <ToggleField
              id="confirmed"
              name="confirmed"
              label="Je confirme l'annulation"
              checked={cancelConfirmed}
              onChange={setCancelConfirmed}
            />
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
