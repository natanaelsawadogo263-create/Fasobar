"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Play,
} from "lucide-react";

import { updateKitchenStatusAction } from "@/app/(protected)/application/cuisine/actions";
import {
  KITCHEN_COLUMNS,
  KITCHEN_NEXT_ACTION,
  KITCHEN_STATUS_LABELS,
  type KitchenOrderTicket,
} from "@/lib/kitchen/constants";
import type { KitchenStatus } from "@/lib/kitchen/schemas";
import { ORDER_TYPE_LABELS } from "@/lib/orders/constants";
import { formatOrderNumber } from "@/lib/orders/constants";

type KitchenWorkspaceProps = {
  orders: KitchenOrderTicket[];
};

const COLUMN_TONE: Record<KitchenStatus, string> = {
  TO_PREPARE: "text-orange-600",
  IN_PREPARATION: "text-blue-600",
  READY: "text-emerald-600",
  SERVED: "text-slate-600",
};

function minutesSince(date: string): number {
  return Math.max(Math.floor((Date.now() - new Date(date).getTime()) / 60000), 0);
}

export function KitchenWorkspace({ orders }: KitchenWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => {
    return KITCHEN_COLUMNS.map((status) => ({
      status,
      title: KITCHEN_STATUS_LABELS[status],
      tone: COLUMN_TONE[status],
      orders: orders.filter((order) => order.kitchenStatus === status),
    }));
  }, [orders]);

  const stats = [
    { label: "Toutes", value: orders.length, tone: "text-slate-900" },
    {
      label: "À préparer",
      value: orders.filter((o) => o.kitchenStatus === "TO_PREPARE").length,
      tone: "text-orange-600",
    },
    {
      label: "En préparation",
      value: orders.filter((o) => o.kitchenStatus === "IN_PREPARATION").length,
      tone: "text-blue-600",
    },
    {
      label: "Prêtes",
      value: orders.filter((o) => o.kitchenStatus === "READY").length,
      tone: "text-emerald-600",
    },
  ];

  function handleAdvance(order: KitchenOrderTicket) {
    const action = KITCHEN_NEXT_ACTION[order.kitchenStatus];
    if (!action.nextStatus) {
      return;
    }

    setError(null);
    setPendingOrderId(order.id);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("orderId", order.id);
      formData.set("status", action.nextStatus!);

      const result = await updateKitchenStatusAction({}, formData);

      setPendingOrderId(null);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f4f6f9]">
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Cuisine</h1>
            <p className="text-sm text-slate-500">Suivez et gérez les commandes en cuisine</p>
          </div>
          <div className="flex flex-wrap gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className={`text-2xl font-bold ${stat.tone}`}>{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-5 xl:grid-cols-4">
        {columns.map((column) => (
          <KitchenColumnView
            key={column.status}
            column={column}
            isPending={isPending}
            pendingOrderId={pendingOrderId}
            onAdvance={handleAdvance}
          />
        ))}
      </div>
    </div>
  );
}

function KitchenColumnView({
  column,
  isPending,
  pendingOrderId,
  onAdvance,
}: {
  column: {
    status: KitchenStatus;
    title: string;
    tone: string;
    orders: KitchenOrderTicket[];
  };
  isPending: boolean;
  pendingOrderId: string | null;
  onAdvance: (order: KitchenOrderTicket) => void;
}) {
  return (
    <section className="flex min-h-[320px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header
        className={`flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-bold ${column.tone}`}
      >
        <Clock className="h-4 w-4" />
        {column.title} ({column.orders.length})
      </header>
      <div className="pos-scroll flex-1 space-y-3 overflow-y-auto p-3">
        {column.orders.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">Aucune commande</p>
        ) : (
          column.orders.map((order) => (
            <KitchenOrderCard
              key={order.id}
              order={order}
              isPending={isPending && pendingOrderId === order.id}
              onAdvance={onAdvance}
            />
          ))
        )}
      </div>
    </section>
  );
}

function KitchenOrderCard({
  order,
  isPending,
  onAdvance,
}: {
  order: KitchenOrderTicket;
  isPending: boolean;
  onAdvance: (order: KitchenOrderTicket) => void;
}) {
  const elapsed = minutesSince(order.kitchenStatusUpdatedAt ?? order.createdAt);
  const reference = order.tableReference ?? order.customerReference ?? "—";
  const urgent = elapsed >= 15 && order.kitchenStatus !== "SERVED";
  const action = KITCHEN_NEXT_ACTION[order.kitchenStatus];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-orange-600">
          {formatOrderNumber(order.orderNumber)}
        </p>
        <div className="flex items-center gap-1.5">
          {urgent ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600">
              <AlertTriangle className="h-3 w-3" />
              Urgent
            </span>
          ) : null}
          <span className="text-[10px] text-slate-400">{elapsed} min</span>
        </div>
      </div>
      <p className="mt-1 text-xs font-medium text-slate-800">{reference}</p>
      <p className="text-[11px] text-slate-500">
        {ORDER_TYPE_LABELS[order.orderType]} · {order.items.length} plat(s)
      </p>

      <ul className="mt-2 space-y-1 border-t border-dashed border-slate-100 pt-2">
        {order.items.map((item) => (
          <li key={item.id} className="text-[11px] text-slate-700">
            <span className="font-semibold">{item.quantity}×</span> {item.productName}
            {item.notes ? (
              <span className="block text-[10px] text-slate-400">Note: {item.notes}</span>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        {action.nextStatus ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => onAdvance(order)}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700 disabled:opacity-50"
          >
            {order.kitchenStatus === "TO_PREPARE" ? (
              <Play className="h-3 w-3" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            {isPending ? "…" : action.label}
          </button>
        ) : null}
        <Link
          href={`/application/commandes/${order.id}`}
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
        >
          <Eye className="h-3 w-3" />
          Détail
        </Link>
      </div>
    </article>
  );
}
