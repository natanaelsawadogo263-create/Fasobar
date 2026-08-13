"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardList, Printer, Search, X } from "lucide-react";

import { OrderPrepBadges } from "@/components/ops/order-prep-badges";
import { getActivityPages } from "@/lib/activity/pages";
import {
  formatOrderNumber,
  formatPriceXof,
  ORDER_PAYMENT_STATUS_LABELS,
  ORDER_PAYMENT_STATUS_STYLES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
} from "@/lib/orders/constants";
import type { OpenOrderListItem } from "@/lib/orders/types";

type OpenOrdersDrawerProps = {
  open: boolean;
  orders: OpenOrderListItem[];
  onClose: () => void;
  onResume: (orderId: string) => void;
  onCheckout: (orderId: string) => void | Promise<void>;
  activityCode?: string | null;
};

type DrawerFilter = "all" | "to_pay" | "hold" | "finalized";

function isFinalized(order: OpenOrderListItem): boolean {
  return order.paymentStatus === "PAID";
}

function isOnHold(order: OpenOrderListItem): boolean {
  return !isFinalized(order) && order.status === "DRAFT";
}

function isAwaitingPayment(order: OpenOrderListItem): boolean {
  return (
    !isFinalized(order) &&
    (order.status === "READY_TO_PAY" || order.status === "OPEN")
  );
}

function statusBadge(order: OpenOrderListItem) {
  if (isFinalized(order)) {
    return {
      label: ORDER_PAYMENT_STATUS_LABELS.PAID,
      className: ORDER_PAYMENT_STATUS_STYLES.PAID,
    };
  }

  return {
    label: ORDER_STATUS_LABELS[order.status],
    className: ORDER_STATUS_STYLES[order.status],
  };
}

export function OpenOrdersDrawer({
  open,
  orders,
  onClose,
  onResume,
  onCheckout,
  activityCode = null,
}: OpenOrdersDrawerProps) {
  const pages = getActivityPages(activityCode);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DrawerFilter>("all");

  const counts = useMemo(
    () => ({
      toPay: orders.filter(isAwaitingPayment).length,
      hold: orders.filter(isOnHold).length,
      finalized: orders.filter(isFinalized).length,
    }),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter === "to_pay" && !isAwaitingPayment(order)) return false;
      if (statusFilter === "hold" && !isOnHold(order)) return false;
      if (statusFilter === "finalized" && !isFinalized(order)) return false;

      if (!search.trim()) {
        return true;
      }

      const query = search.toLowerCase();
      const reference = order.tableReference ?? order.customerReference ?? "";
      return (
        formatOrderNumber(order.orderNumber).toLowerCase().includes(query) ||
        reference.toLowerCase().includes(query) ||
        (order.createdByName?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [orders, search, statusFilter]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="presentation">
      <button
        type="button"
        aria-label="Fermer le panneau"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-orders-title"
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="open-orders-title" className="text-lg font-semibold text-slate-900">
              {pages.openTickets.title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {counts.toPay} à encaisser · {counts.hold} brouillon
              {counts.hold > 1 ? "s" : ""} · {counts.finalized} terminée
              {counts.finalized > 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="shrink-0 space-y-3 border-b border-slate-100 px-5 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={pages.openTickets.searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "all" as const, label: "Toutes", count: orders.length },
                { id: "to_pay" as const, label: "À encaisser", count: counts.toPay },
                { id: "hold" as const, label: "Brouillons", count: counts.hold },
                {
                  id: "finalized" as const,
                  label: "Terminées",
                  count: counts.finalized,
                },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  statusFilter === filter.id
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {filter.label}
                <span
                  className={`inline-flex min-w-[1.1rem] justify-center rounded-full px-1 text-[10px] font-bold ${
                    statusFilter === filter.id
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-500"
                  }`}
                >
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-16 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <ClipboardList className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{pages.tickets.emptyTitle}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {search || statusFilter !== "all"
                  ? "Aucun résultat pour ce filtre."
                  : "Les commandes apparaîtront ici."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const badge = statusBadge(order);
                const finalized = isFinalized(order);

                return (
                  <article
                    key={order.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {formatOrderNumber(order.orderNumber)}
                        </p>
                        <p className="text-sm text-slate-600">
                          {order.tableReference ?? order.customerReference ?? "—"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {pages.retail ? null : (
                      <OrderPrepBadges
                        barStatus={order.barStatus}
                        kitchenStatus={order.kitchenStatus}
                        className="mt-2"
                      />
                    )}

                    <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                      <div>
                        <dt>Heure</dt>
                        <dd className="font-medium text-slate-800">
                          {new Date(order.createdAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </dd>
                      </div>
                      <div>
                        <dt>Articles</dt>
                        <dd className="font-medium text-slate-800">{order.itemCount}</dd>
                      </div>
                      <div>
                        <dt>Total</dt>
                        <dd className="pos-tabular font-semibold text-emerald-700">
                          {formatPriceXof(order.totalAmount)}
                        </dd>
                      </div>
                    </dl>

                    {order.createdByName ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {pages.tickets.cashierColumn} : {order.createdByName}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {finalized ? (
                        <>
                          {order.receiptId ? (
                            <Link
                              href={`/application/recus/${order.receiptId}`}
                              onClick={onClose}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Voir le reçu
                            </Link>
                          ) : null}
                          <Link
                            href={`/application/commandes/${order.id}`}
                            onClick={onClose}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Voir le détail
                          </Link>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onResume(order.id);
                              onClose();
                            }}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Reprendre
                          </button>
                          <Link
                            href={`/application/commandes/${order.id}/addition?print=1&next=${encodeURIComponent("/application/caisse")}`}
                            onClick={onClose}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            {pages.pos.additionLabel}
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              onCheckout(order.id);
                              onClose();
                            }}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                          >
                            Encaisser
                          </button>
                          <Link
                            href={`/application/commandes/${order.id}`}
                            onClick={onClose}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Voir le détail
                          </Link>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
