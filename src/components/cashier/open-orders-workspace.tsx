"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { InstantLink as Link } from "@/components/layout/instant-link";
import { ClipboardList, Plus, Search } from "lucide-react";

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
import { createClient } from "@/lib/supabase/client";
import { bindRealtimeAuth } from "@/lib/supabase/realtime-session";

type OpenOrdersWorkspaceProps = {
  establishmentName: string;
  orders: OpenOrderListItem[];
  canManageOrders: boolean;
  canOperateCashRegister?: boolean;
  activityCode?: string | null;
  /** Sync temps réel multi-appareils (même établissement). */
  establishmentId?: string;
};

function isFinalized(order: OpenOrderListItem): boolean {
  return order.paymentStatus === "PAID";
}

function badgeFor(order: OpenOrderListItem) {
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

type SectionProps = {
  title: string;
  emptyLabel: string;
  orders: OpenOrderListItem[];
  canManageOrders: boolean;
  canOperateCashRegister: boolean;
  showPrepBadges: boolean;
  clientColumnLabel: string;
  cashierColumnLabel: string;
};

function OrdersSection({
  title,
  emptyLabel,
  orders,
  canManageOrders,
  canOperateCashRegister,
  showPrepBadges,
  clientColumnLabel,
  cashierColumnLabel,
}: SectionProps) {
  if (orders.length === 0) {
    return null;
  }

  return (
    <section className="mb-5 last:mb-0">
      <h2 className="mb-2 flex items-center gap-2 px-0.5 text-[13px] font-bold uppercase tracking-wide text-slate-500">
        {title}
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-[11px] font-bold text-slate-700">
          {orders.length}
        </span>
      </h2>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
          {emptyLabel}
        </p>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {orders.map((order) => {
              const badge = badgeFor(order);
              const finalized = isFinalized(order);
              return (
                <article
                  key={order.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-emerald-700">
                        {formatOrderNumber(order.orderNumber)}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-slate-700">
                        {order.tableReference ?? order.customerReference ?? "—"}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] text-slate-500">
                    {new Date(order.createdAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {order.itemCount} art. · {order.createdByName ?? "—"}
                  </p>
                  <p className="pos-tabular mt-1 text-[16px] font-bold text-slate-900">
                    {formatPriceXof(order.totalAmount)}
                  </p>
                  {showPrepBadges ? (
                    <div className="mt-2">
                      <OrderPrepBadges
                        barStatus={order.barStatus}
                        kitchenStatus={order.kitchenStatus}
                      />
                    </div>
                  ) : null}
                  {canManageOrders ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {finalized ? (
                        <>
                          {order.receiptId ? (
                            <Link
                              href={`/application/recus/${order.receiptId}`}
                              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 text-[13px] font-semibold text-white"
                            >
                              Reçu
                            </Link>
                          ) : (
                            <span />
                          )}
                          <Link
                            href={`/application/commandes/${order.id}`}
                            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700"
                          >
                            Détail
                          </Link>
                        </>
                      ) : canOperateCashRegister ? (
                        <>
                          <Link
                            href={`/application/caisse?order=${order.id}`}
                            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700"
                          >
                            Reprendre
                          </Link>
                          <Link
                            href={`/application/caisse?order=${order.id}`}
                            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 text-[13px] font-semibold text-white"
                          >
                            Encaisser
                          </Link>
                        </>
                      ) : (
                        <Link
                          href={`/application/commandes/${order.id}`}
                          className="col-span-2 inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700"
                        >
                          Consulter
                        </Link>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">N°</th>
                    <th className="px-4 py-3 font-semibold">{clientColumnLabel}</th>
                    <th className="px-4 py-3 font-semibold">Heure</th>
                    <th className="px-4 py-3 font-semibold">Articles</th>
                    <th className="px-4 py-3 font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">{cashierColumnLabel}</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    {canManageOrders ? (
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => {
                    const badge = badgeFor(order);
                    const finalized = isFinalized(order);

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3.5 font-semibold text-emerald-700">
                          {formatOrderNumber(order.orderNumber)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {order.tableReference ?? order.customerReference ?? "—"}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {new Date(order.createdAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3.5">{order.itemCount}</td>
                        <td className="pos-tabular px-4 py-3.5 font-bold text-slate-900">
                          {formatPriceXof(order.totalAmount)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {order.createdByName ?? "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            {showPrepBadges ? (
                              <OrderPrepBadges
                                barStatus={order.barStatus}
                                kitchenStatus={order.kitchenStatus}
                              />
                            ) : null}
                          </div>
                        </td>
                        {canManageOrders ? (
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-2">
                              {finalized ? (
                                <>
                                  {order.receiptId ? (
                                    <Link
                                      href={`/application/recus/${order.receiptId}`}
                                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                    >
                                      Reçu
                                    </Link>
                                  ) : null}
                                  <Link
                                    href={`/application/commandes/${order.id}`}
                                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    Détail
                                  </Link>
                                </>
                              ) : canOperateCashRegister ? (
                                <>
                                  <Link
                                    href={`/application/caisse?order=${order.id}`}
                                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    Reprendre
                                  </Link>
                                  <Link
                                    href={`/application/caisse?order=${order.id}`}
                                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                  >
                                    Encaisser
                                  </Link>
                                </>
                              ) : (
                                <Link
                                  href={`/application/commandes/${order.id}`}
                                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Consulter
                                </Link>
                              )}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function OpenOrdersWorkspace({
  establishmentName,
  orders,
  canManageOrders,
  canOperateCashRegister = false,
  activityCode = null,
  establishmentId,
}: OpenOrdersWorkspaceProps) {
  const router = useRouter();
  const pages = getActivityPages(activityCode);

  // Multi-appareils : une commande créée/encaissée depuis un autre appareil
  // (caisse, cuisine, bar...) du même établissement doit apparaître ici sans
  // que le caissier ait à recharger la page manuellement.
  useEffect(() => {
    if (!establishmentId) return;

    const supabase = createClient();
    let unbindAuth: (() => void) | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        if (!cancelled) router.refresh();
      }, 1500);
    };

    const channel = supabase
      .channel(`open-orders-live:${establishmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        scheduleRefresh,
      );

    void bindRealtimeAuth(supabase).then((unbind) => {
      if (cancelled) return;
      unbindAuth = unbind;
      channel.subscribe();
    });

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      unbindAuth?.();
      void supabase.removeChannel(channel);
    };
  }, [establishmentId, router]);

  // Un seul groupe « à encaisser » (tickets ouverts, mis de côté ou prêts) + « terminées ».
  const toEncaisserOrders = orders.filter((order) => !isFinalized(order));
  const finalizedOrders = orders.filter(isFinalized);
  const openCount = toEncaisserOrders.length;
  const doneCount = finalizedOrders.length;
  const showPrepBadges = !pages.retail;

  const sectionCommonProps = {
    canManageOrders,
    canOperateCashRegister,
    showPrepBadges,
    clientColumnLabel: pages.tickets.clientColumn,
    cashierColumnLabel: pages.tickets.cashierColumn,
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f4f6f9]">
      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-slate-900 sm:text-xl">
              {pages.openTickets.title}
            </h1>
            <p className="mt-0.5 text-[12px] text-slate-500 sm:text-sm">
              {establishmentName} · {openCount} à encaisser · {doneCount} terminée
              {doneCount > 1 ? "s" : ""}
            </p>
          </div>
          {canOperateCashRegister ? (
            <Link
              href="/application/caisse"
              className="inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[13px] font-semibold text-white active:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              {pages.openTickets.newButton}
            </Link>
          ) : null}
        </div>

        <div className="mt-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder={pages.openTickets.searchPlaceholder}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-[16px] outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 sm:text-sm"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ClipboardList className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              {pages.openTickets.emptyTitle}
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              {pages.openTickets.emptyDetail}
            </p>
          </div>
        ) : (
          <>
            <OrdersSection
              title={ORDER_STATUS_LABELS.READY_TO_PAY}
              emptyLabel="Aucune commande à encaisser."
              orders={toEncaisserOrders}
              {...sectionCommonProps}
            />
            <OrdersSection
              title="Terminées"
              emptyLabel="Aucune commande terminée."
              orders={finalizedOrders}
              {...sectionCommonProps}
            />
          </>
        )}
      </div>
    </div>
  );
}
