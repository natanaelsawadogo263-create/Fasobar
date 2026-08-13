"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  Filter,
  GlassWater,
  RefreshCw,
  Wine,
} from "lucide-react";

import { updateBarStatusAction } from "@/app/(protected)/application/bar/actions";
import { usePrepTicketChime } from "@/hooks/use-prep-ticket-chime";
import { scheduleOpsRefresh } from "@/lib/ops/schedule-refresh";
import { createClient } from "@/lib/supabase/client";
import {
  BAR_BOARD_COLUMNS,
  BAR_NEXT_ACTION,
  BAR_STATUS_LABELS,
  formatBarAge,
  formatBarOrderNumber,
  type BarOrderTicket,
} from "@/lib/bar/constants";
import type { BarPrepStatus } from "@/lib/bar/schemas";
import {
  formatPriceXof,
  ORDER_PAYMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
} from "@/lib/orders/constants";
import type { OrderPaymentStatus, OrderStatus } from "@/lib/orders/schemas";
import { AlertMessage } from "@/components/auth/alert-message";
import { ModalShell } from "@/components/ui/modal-shell";

type BarOrdersWorkspaceProps = {
  orders: BarOrderTicket[];
  establishmentId?: string;
};

const COLUMN_META: Record<
  BarPrepStatus,
  { icon: typeof GlassWater; badge: string; iconTone: string }
> = {
  TO_PREPARE: {
    icon: GlassWater,
    badge: "bg-amber-100 text-amber-800",
    iconTone: "text-amber-500",
  },
  IN_PREPARATION: {
    icon: Wine,
    badge: "bg-sky-100 text-sky-800",
    iconTone: "text-sky-500",
  },
  READY: {
    icon: CheckCircle2,
    badge: "bg-emerald-100 text-emerald-800",
    iconTone: "text-emerald-500",
  },
};

function drinkCount(order: BarOrderTicket) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function drinksTotal(order: BarOrderTicket) {
  return order.items.reduce((sum, item) => sum + item.lineTotal, 0);
}

function statusLabel(status: string) {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

function paymentLabel(status: string) {
  return (
    ORDER_PAYMENT_STATUS_LABELS[status as OrderPaymentStatus] ?? status
  );
}

export function BarOrdersWorkspace({
  orders,
  establishmentId,
}: BarOrdersWorkspaceProps) {
  const router = useRouter();
  const [tickets, setTickets] = useState(orders);
  const [error, setError] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<BarOrderTicket | null>(null);
  const [tableFilter, setTableFilter] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<BarPrepStatus>("TO_PREPARE");

  useEffect(() => {
    setTickets(orders);
  }, [orders]);

  const toPrepareIds = useMemo(
    () => tickets.filter((ticket) => ticket.barStatus === "TO_PREPARE").map((ticket) => ticket.id),
    [tickets],
  );
  usePrepTicketChime(toPrepareIds, "Nouvelle commande au bar");

  useEffect(() => {
    if (!establishmentId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`bar-orders-live:${establishmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            bar_status?: BarPrepStatus | null;
            status?: string;
            payment_status?: string;
          };
          if (!row.id) return;
          if (row.status === "CANCELLED" || row.payment_status === "PAID") {
            setTickets((prev) => prev.filter((ticket) => ticket.id !== row.id));
            return;
          }
          scheduleOpsRefresh(() => router.refresh());
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => scheduleOpsRefresh(() => router.refresh()),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [establishmentId, router]);

  const filtered = useMemo(() => {
    const needle = tableFilter.trim().toLowerCase();
    if (!needle) return tickets;
    return tickets.filter((order) => {
      const itemsText = order.items.map((item) => item.productName).join(" ");
      const haystack =
        `${formatBarOrderNumber(order.orderNumber)} ${order.tableReference ?? ""} ${order.customerReference ?? ""} ${itemsText}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [tickets, tableFilter]);

  const columns = BAR_BOARD_COLUMNS.map((status) => ({
    status,
    title: BAR_STATUS_LABELS[status],
    ...COLUMN_META[status],
    orders: filtered.filter((order) => order.barStatus === status),
  }));

  function handleAdvance(order: BarOrderTicket) {
    const action = BAR_NEXT_ACTION[order.barStatus];
    if (!action.nextStatus) {
      setDetailOrder(order);
      return;
    }

    const previousStatus = order.barStatus;
    const nextStatus = action.nextStatus;
    setError(null);
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === order.id
          ? {
              ...ticket,
              barStatus: nextStatus,
              barStatusUpdatedAt: new Date().toISOString(),
            }
          : ticket,
      ),
    );

    const formData = new FormData();
    formData.set("orderId", order.id);
    formData.set("status", nextStatus);
    void updateBarStatusAction({}, formData).then((result) => {
      if (!result.error) return;
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === order.id
            ? { ...ticket, barStatus: previousStatus }
            : ticket,
        ),
      );
      setError(result.error);
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3 lg:gap-3.5 lg:p-4">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
            Commandes boissons
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Tous les détails de chaque commande (articles, quantités, notes, totaux).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilter((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            <Filter className="h-3.5 w-3.5" />
            Filtrer
          </button>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </button>
        </div>
      </header>

      {showFilter ? (
        <div className="shrink-0">
          <input
            type="search"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            placeholder="Filtrer par table, n° ou boisson…"
            className="h-9 w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 text-[12px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      ) : null}

      {error ? (
        <div className="shrink-0">
          <AlertMessage message={error} />
        </div>
      ) : null}

      {/* Mobile : une colonne à la fois */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden md:hidden">
        <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-0.5">
          {columns.map((column) => {
            const active = mobileColumn === column.status;
            return (
              <button
                key={column.status}
                type="button"
                onClick={() => setMobileColumn(column.status)}
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-[12px] font-semibold transition ${
                  active
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {column.title}
                <span
                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${column.badge}`}
                >
                  {column.orders.length}
                </span>
              </button>
            );
          })}
        </div>
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto">
          {(columns.find((c) => c.status === mobileColumn)?.orders ?? []).length ===
          0 ? (
            <p className="py-12 text-center text-[13px] text-slate-400">
              Aucune commande
            </p>
          ) : (
            (columns.find((c) => c.status === mobileColumn)?.orders ?? []).map(
              (order) => (
                <BarOrderCard
                  key={order.id}
                  order={order}
                  onAdvance={() => handleAdvance(order)}
                  onOpenDetail={() => setDetailOrder(order)}
                />
              ),
            )
          )}
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden md:grid md:grid-cols-3">
        {columns.map((column) => {
          const Icon = column.icon;
          return (
            <section
              key={column.status}
              className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
            >
              <header className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3.5 py-2.5">
                <Icon className={`h-4 w-4 ${column.iconTone}`} />
                <span className="text-[13px] font-semibold text-slate-800">
                  {column.title}
                </span>
                <span
                  className={`ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${column.badge}`}
                >
                  {column.orders.length}
                </span>
              </header>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
                {column.orders.length === 0 ? (
                  <p className="py-10 text-center text-[12px] text-slate-400">
                    Aucune commande
                  </p>
                ) : (
                  column.orders.map((order) => (
                    <BarOrderCard
                      key={order.id}
                      order={order}
                      onAdvance={() => handleAdvance(order)}
                      onOpenDetail={() => setDetailOrder(order)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {detailOrder ? (
        <BarOrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
        />
      ) : null}
    </div>
  );
}

function BarOrderCard({
  order,
  onAdvance,
  onOpenDetail,
}: {
  order: BarOrderTicket;
  onAdvance: () => void;
  onOpenDetail: () => void;
}) {
  const qty = drinkCount(order);
  const next = BAR_NEXT_ACTION[order.barStatus];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold text-slate-900">
            {formatBarOrderNumber(order.orderNumber)}
          </p>
          <p className="text-[11px] text-slate-500">
            {order.tableReference || order.customerReference || "Sans table"}
            <span className="text-slate-300"> · </span>
            {ORDER_TYPE_LABELS[order.orderType]}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <Clock3 className="h-3 w-3" />
          {formatBarAge(order.barStatusUpdatedAt ?? order.createdAt)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          {statusLabel(order.status)}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          {paymentLabel(order.paymentStatus)}
        </span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          {qty} boisson{qty > 1 ? "s" : ""}
        </span>
        {order.isSupplement ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            Ajout
          </span>
        ) : null}
      </div>

      <ul className="mt-2.5 space-y-1.5 rounded-lg bg-slate-50 p-2">
        {order.items.map((item) => (
          <li key={item.id} className="text-[12px] text-slate-800">
            <div className="flex items-start gap-2">
              <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-emerald-600 px-1.5 text-[11px] font-bold text-white">
                {item.quantity}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-snug">{item.productName}</p>
                  <p className="pos-tabular shrink-0 text-[11px] font-medium text-slate-600">
                    {formatPriceXof(item.lineTotal)}
                  </p>
                </div>
                {item.notes ? (
                  <p className="mt-0.5 text-[11px] text-amber-700">
                    Note : {item.notes}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {order.notes ? (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          Commande : {order.notes}
        </p>
      ) : null}

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          {order.createdByName ? `Caissier : ${order.createdByName}` : "—"}
        </span>
        <span className="pos-tabular font-semibold text-slate-800">
          {formatPriceXof(drinksTotal(order))}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenDetail}
          className="inline-flex h-11 items-center px-1 text-[12px] font-semibold text-emerald-700 sm:h-auto sm:text-[11px]"
        >
          Voir le détail
        </button>
        {order.barStatus === "READY" ? (
          <span className="inline-flex h-11 items-center gap-1 rounded-xl bg-emerald-50 px-3 text-[12px] font-semibold text-emerald-700 sm:h-auto sm:rounded-full sm:px-2.5 sm:py-1 sm:text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Prête
          </span>
        ) : (
          <button
            type="button"
            onClick={onAdvance}
            className="inline-flex h-11 items-center rounded-xl bg-emerald-600 px-4 text-[13px] font-semibold text-white active:bg-emerald-500 sm:h-8 sm:rounded-lg sm:px-3 sm:text-[12px]"
          >
            {next.label}
          </button>
        )}
      </div>
    </article>
  );
}

function BarOrderDetailModal({
  order,
  onClose,
}: {
  order: BarOrderTicket;
  onClose: () => void;
}) {
  const qty = drinkCount(order);
  const drinksAmount = drinksTotal(order);

  return (
    <ModalShell
      title={formatBarOrderNumber(order.orderNumber)}
      subtitle={`${order.tableReference || order.customerReference || "Sans table"} · ${ORDER_TYPE_LABELS[order.orderType]}`}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-[13px] font-semibold text-white hover:bg-emerald-500"
        >
          Fermer
        </button>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[12px]">
          <div>
            <dt className="text-slate-500">Heure</dt>
            <dd className="font-medium text-slate-900">
              {new Date(order.createdAt).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Âge</dt>
            <dd className="font-medium text-slate-900">
              {formatBarAge(order.barStatusUpdatedAt ?? order.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Statut commande</dt>
            <dd className="font-medium text-slate-900">{statusLabel(order.status)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Paiement</dt>
            <dd className="font-medium text-slate-900">
              {paymentLabel(order.paymentStatus)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Préparation bar</dt>
            <dd className="font-medium text-slate-900">
              {BAR_STATUS_LABELS[order.barStatus]}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Caissier</dt>
            <dd className="font-medium text-slate-900">
              {order.createdByName ?? "—"}
            </dd>
          </div>
        </dl>

        {order.notes ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <span className="font-semibold">Note commande :</span> {order.notes}
          </p>
        ) : null}

        <div>
          <p className="mb-2 text-[12px] font-semibold text-slate-800">
            {order.isSupplement ? "Ajout · " : ""}Boissons ({qty})
          </p>
          <ul className="space-y-2">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-[13px] shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{item.productName}</p>
                    <p className="pos-tabular mt-0.5 text-[11px] text-slate-500">
                      {item.quantity} × {formatPriceXof(item.unitPrice)}
                    </p>
                    {item.notes ? (
                      <p className="mt-1 text-[12px] text-amber-700">
                        Note : {item.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-emerald-600 px-2 text-[12px] font-bold text-white">
                      ×{item.quantity}
                    </span>
                    <p className="pos-tabular mt-1 text-[12px] font-semibold text-slate-800">
                      {formatPriceXof(item.lineTotal)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px]">
          <div className="flex justify-between text-slate-600">
            <span>Sous-total boissons</span>
            <span className="pos-tabular font-medium text-slate-900">
              {formatPriceXof(drinksAmount)}
            </span>
          </div>
          {order.discountAmount > 0 ? (
            <div className="flex justify-between text-slate-600">
              <span>Remise commande</span>
              <span className="pos-tabular font-medium text-red-600">
                −{formatPriceXof(order.discountAmount)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-[13px] font-semibold text-slate-900">
            <span>Total commande</span>
            <span className="pos-tabular text-emerald-700">
              {formatPriceXof(order.totalAmount)}
            </span>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
