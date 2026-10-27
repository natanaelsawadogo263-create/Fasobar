"use client";

import { useMemo, useTransition, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronDown, Loader2, MapPin, Wallet } from "lucide-react";

import { CourierPage, useNow } from "@/components/delivery/courier-ui";
import { Badge } from "@/components/ui/badge";
import {
  COURIER_HISTORY_LIMIT,
  COURIER_HISTORY_PERIODS,
  formatDeliveryOrderNumber,
  formatDeliveryQuantity,
  type CourierHistoryPeriodId,
} from "@/lib/delivery/constants";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";

type CourierHistoryProps = {
  history: DeliveryOrder[];
  period: CourierHistoryPeriodId;
  limitReached: boolean;
};

type DayGroup = {
  key: string;
  date: Date;
  orders: DeliveryOrder[];
  total: number;
};

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(date: Date, now: number | null): string {
  if (now !== null) {
    const today = new Date(now);
    if (dayKey(date) === dayKey(today)) return "Aujourd’hui";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dayKey(date) === dayKey(yesterday)) return "Hier";
  }
  const label = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: now !== null && date.getFullYear() === new Date(now).getFullYear() ? undefined : "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatTimeFr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Durée entre l'acceptation et la livraison (« 25 min », « 1 h 10 »). */
function deliveryDuration(order: DeliveryOrder): string | null {
  if (!order.acceptedAt || !order.deliveredAt) return null;
  const minutes = Math.round(
    (new Date(order.deliveredAt).getTime() - new Date(order.acceptedAt).getTime()) / 60_000,
  );
  if (minutes < 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest > 0 ? ` ${String(rest).padStart(2, "0")}` : ""}`;
}

export function CourierHistory({ history, period, limitReached }: CourierHistoryProps) {
  const now = useNow();
  const router = useRouter();
  const [isLoading, startTransition] = useTransition();

  const groups = useMemo(() => {
    const byDay = new Map<string, DayGroup>();
    for (const order of history) {
      if (!order.deliveredAt) continue;
      const date = new Date(order.deliveredAt);
      const key = dayKey(date);
      const group = byDay.get(key) ?? { key, date, orders: [], total: 0 };
      group.orders.push(order);
      group.total += order.totalAmount;
      byDay.set(key, group);
    }
    return [...byDay.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [history]);

  const totalValue = history.reduce((sum, order) => sum + order.totalAmount, 0);
  const activeDays = groups.length;
  const periodLabel = COURIER_HISTORY_PERIODS.find((item) => item.id === period)?.label ?? "";

  function selectPeriod(id: CourierHistoryPeriodId) {
    if (id === period) return;
    startTransition(() => {
      router.replace(`/application/livreur/historique?periode=${id}`, { scroll: false });
    });
  }

  return (
    <CourierPage
      title="Historique des livraisons"
      aside={
        isLoading ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Chargement…
          </span>
        ) : null
      }
    >

      <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="radiogroup" aria-label="Période">
        {COURIER_HISTORY_PERIODS.map((item) => {
          const active = item.id === period;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => selectPeriod(item.id)}
              disabled={isLoading}
              className={`inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[12px] font-semibold transition disabled:opacity-60 ${
                active
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <Summary icon={CheckCircle2} label="Livraisons" value={String(history.length)} />
        <Summary icon={Wallet} label="Montant livré" value={formatPriceXof(totalValue)} />
        <Summary icon={CalendarDays} label="Jours actifs" value={String(activeDays)} />
        <p className="col-span-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
          Période : {periodLabel.toLowerCase()}
          {activeDays > 0
            ? ` · moyenne ${formatDeliveryQuantity(Math.round((history.length / activeDays) * 10) / 10)} livraison(s) par jour actif`
            : ""}
        </p>
      </div>

      {limitReached ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Seules vos {COURIER_HISTORY_LIMIT} dernières livraisons sont affichées. Choisissez une période plus
          courte pour un détail complet.
        </p>
      ) : null}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <p className="text-[14px] font-semibold text-slate-800">Aucune livraison sur cette période</p>
          <p className="max-w-sm text-[12px] text-slate-500">
            Vos livraisons confirmées apparaîtront ici avec le montant encaissé.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <div
            key={group.key}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <p className="text-[13px] font-bold text-slate-900">{dayLabel(group.date, now)}</p>
              <p className="text-[12px] text-slate-600">
                <span className="font-semibold text-slate-900">
                  {group.orders.length} livraison{group.orders.length > 1 ? "s" : ""}
                </span>
                {" · "}
                <span className="font-semibold tabular-nums text-emerald-700">
                  {formatPriceXof(group.total)}
                </span>
              </p>
            </header>
            <ul className="divide-y divide-slate-100">
              {group.orders.map((order) => (
                <HistoryRow key={order.id} order={order} />
              ))}
            </ul>
          </div>
        ))
      )}
    </CourierPage>
  );
}

function HistoryRow({ order }: { order: DeliveryOrder }) {
  const duration = deliveryDuration(order);

  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-slate-900">
              {formatDeliveryOrderNumber(order.orderNumber)}
              {order.customerName ? (
                <span className="font-normal text-slate-500"> · {order.customerName}</span>
              ) : null}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              Livrée à {formatTimeFr(order.deliveredAt)}
              {duration ? ` · en ${duration}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p className="text-[14px] font-bold tabular-nums text-slate-900">
                {formatPriceXof(order.totalAmount)}
              </p>
              {order.cashedAt ? (
                <Badge tone="emerald">Remis à la caisse</Badge>
              ) : (
                <Badge tone="orange">À remettre</Badge>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
          </div>
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-3">
          {order.deliveryAddress ? (
            <p className="flex items-start gap-1.5 text-[12px] text-slate-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              {order.deliveryAddress}
            </p>
          ) : null}
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/60 text-[12px]">
            {order.items.map((item) => (
              <li key={item.productId} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="min-w-0 truncate text-slate-700">
                  <span className="font-semibold">{formatDeliveryQuantity(item.quantity)} ×</span>{" "}
                  {item.productName}
                </span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {formatPriceXof(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </li>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="truncate text-[16px] font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
