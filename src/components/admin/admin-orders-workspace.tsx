"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Search } from "lucide-react";

import { cancelOrderAction } from "@/app/(protected)/application/caisse/actions";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { AlertMessage } from "@/components/auth/alert-message";
import { OrderPrepBadges } from "@/components/ops/order-prep-badges";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
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
  shiftOrderPeriodAnchor,
  toLocalIsoDate,
} from "@/lib/orders/period";
import type {
  AdminOrderDepartmentFilter,
  AdminOrderFiltersInput,
  AdminOrderPeriodFilter,
  AdminOrderStatusFilter,
} from "@/lib/orders/schemas";
import type { AdminOrderListItem, OrderCashierOption } from "@/lib/orders/types";

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
};

const DEPARTMENT_LABELS: Record<string, string> = {
  BAR: "Boissons",
  KITCHEN: "Cuisine",
};

const PERIOD_OPTIONS: Array<{ id: AdminOrderPeriodFilter; label: string }> = [
  { id: "all", label: "Tout" },
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
  cancelledCount,
  totalRevenue,
  filters,
  periodLabel,
  cashiers,
  establishmentName,
  canManageOrders,
}: AdminOrdersWorkspaceProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminOrderListItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const activePeriod = filters.period ?? "all";
  const anchor = filters.from ?? toLocalIsoDate(new Date());

  function applyFilters(next: Partial<AdminOrderFiltersInput>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.status && merged.status !== "all") params.set("status", merged.status);
    if (merged.department && merged.department !== "all")
      params.set("department", merged.department);
    if (merged.period && merged.period !== "all") params.set("period", merged.period);
    if (merged.cashierId) params.set("cashierId", merged.cashierId);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.search) params.set("search", merged.search);
    router.push(`/application/commandes?${params.toString()}`);
  }

  function applyPeriod(period: AdminOrderPeriodFilter, nextAnchor = anchor) {
    const range = resolveOrderPeriodRange(period, nextAnchor);
    applyFilters({
      period,
      from: range.from,
      to: range.to,
    });
  }

  function shiftPeriod(direction: -1 | 1) {
    if (activePeriod === "all") return;
    const nextAnchor = shiftOrderPeriodAnchor(activePeriod, anchor, direction);
    applyPeriod(activePeriod, nextAnchor);
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
      value: String(totalOrders),
      accent: "text-slate-900",
    },
    {
      title: "En cours",
      value: String(openCount),
      accent: "text-amber-700",
    },
    {
      title: "Terminées",
      value: String(paidCount),
      accent: "text-emerald-700",
    },
    {
      title: "Chiffre d'affaires",
      value: formatPriceXof(totalRevenue),
      accent: "text-emerald-700",
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2.5 lg:gap-2.5 lg:p-3">
      <header className="shrink-0">
        <h1 className="text-[18px] font-bold leading-none tracking-tight text-slate-900 lg:text-[20px]">
          Commandes
        </h1>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {establishmentName} · {periodLabel} · {cancelledCount} annulée
          {cancelledCount > 1 ? "s" : ""}
        </p>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
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

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            defaultValue={filters.search ?? ""}
            placeholder="Rechercher N°, table, caissière…"
            className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-[12px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
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
        <select
          value={filters.status || "all"}
          onChange={(event) =>
            applyFilters({ status: event.target.value as AdminOrderStatusFilter })
          }
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px]"
        >
          <option value="all">Tous statuts</option>
          <option value="open">En cours</option>
          <option value="paid">Terminées</option>
          <option value="cancelled">Annulées</option>
        </select>
        <select
          value={filters.department || "all"}
          onChange={(event) =>
            applyFilters({ department: event.target.value as AdminOrderDepartmentFilter })
          }
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px]"
        >
          <option value="all">Tous départements</option>
          <option value="BAR">Boissons</option>
          <option value="KITCHEN">Cuisine</option>
        </select>
        <select
          value={filters.cashierId || ""}
          onChange={(event) => applyFilters({ cashierId: event.target.value })}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px]"
        >
          <option value="">Tous caissiers</option>
          {cashiers.map((cashier) => (
            <option key={cashier.id} value={cashier.id}>
              {cashier.fullName}
            </option>
          ))}
        </select>
        <div className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white p-0.5">
          {PERIOD_OPTIONS.map((option) => {
            const isActive = activePeriod === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => applyPeriod(option.id)}
                className={`h-7 rounded-md px-2 text-[11px] font-semibold transition ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {activePeriod !== "all" ? (
          <div className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-1">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              aria-label="Période précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {activePeriod === "day" ? (
              <input
                type="date"
                value={anchor}
                onChange={(event) => applyPeriod("day", event.target.value)}
                className="h-7 min-w-[128px] border-0 bg-transparent px-1 text-[12px] text-slate-800 outline-none"
              />
            ) : activePeriod === "month" ? (
              <input
                type="month"
                value={anchor.slice(0, 7)}
                onChange={(event) =>
                  applyPeriod("month", `${event.target.value}-01`)
                }
                className="h-7 min-w-[128px] border-0 bg-transparent px-1 text-[12px] text-slate-800 outline-none"
              />
            ) : (
              <span className="min-w-[140px] px-1 text-center text-[11px] font-medium capitalize text-slate-700">
                {periodLabel}
              </span>
            )}
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              aria-label="Période suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        {orders.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h2 className="mt-3 text-[15px] font-semibold text-slate-900">Aucune commande</h2>
            <p className="mt-1 max-w-sm text-[12px] text-slate-500">
              Ajustez les filtres pour retrouver les commandes de l&apos;établissement.
            </p>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2.5 py-2 font-semibold">N°</th>
                  <th className="px-2.5 py-2 font-semibold">Table / Réf.</th>
                  <th className="px-2.5 py-2 font-semibold">Département</th>
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
                      {order.tableReference ?? order.customerReference ?? "—"}
                    </td>
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
        )}
      </div>

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
