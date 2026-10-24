"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Boxes,
  CheckCircle2,
  Hand,
  Inbox,
  PackageCheck,
  Radio,
  Truck,
  Undo2,
  Wallet,
} from "lucide-react";

import {
  acceptDeliveryOrderAction,
  completeDeliveryOrderAction,
  releaseDeliveryOrderAction,
} from "@/app/(protected)/application/livreur/actions";
import { CourierOrderCard, type StockShortage } from "@/components/delivery/courier-order-card";
import { Badge } from "@/components/ui/badge";
import { ModalFooter } from "@/components/ui/modal-footer";
import { ModalShell } from "@/components/ui/modal-shell";
import { useToast } from "@/components/ui/toast";
import { useDeliveryOrdersLive } from "@/hooks/use-delivery-orders-live";
import {
  COURIER_MOVEMENT_LABELS,
  formatDeliveryOrderNumber,
  formatDeliveryQuantity,
} from "@/lib/delivery/constants";
import type {
  CourierMovement,
  CourierStockLine,
  CourierStockMovementType,
  DeliveryOrder,
} from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";
import { formatDateTimeFr } from "@/lib/sales/constants";

type CourierWorkspaceProps = {
  establishmentId: string;
  courierName: string;
  availableOrders: DeliveryOrder[];
  myOrders: DeliveryOrder[];
  deliveredToday: DeliveryOrder[];
  stock: CourierStockLine[];
  movements: CourierMovement[];
};

type Tab = "available" | "mine" | "delivered" | "stock";

type ActionResult = { success?: string; error?: string };

type PendingConfirm = {
  kind: "complete" | "release";
  order: DeliveryOrder;
};

const NOW_REFRESH_MS = 30_000;

const MOVEMENT_TONES: Record<CourierStockMovementType, "emerald" | "amber" | "sky"> = {
  ALLOCATION: "emerald",
  RETURN: "amber",
  DELIVERY: "sky",
};

/** Heure courante côté client uniquement (null au rendu serveur : pas d'écart d'hydratation). */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, NOW_REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  return now;
}

function elapsedSince(iso: string | null, now: number | null, prefix: string): string | null {
  if (!iso || now === null) return null;
  const minutes = Math.max(Math.floor((now - new Date(iso).getTime()) / 60_000), 0);
  if (minutes < 1) return `${prefix} à l’instant`;
  if (minutes < 60) return `${prefix} il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${prefix} il y a ${hours} h${rest > 0 ? ` ${String(rest).padStart(2, "0")}` : ""}`;
}

function formatTimeFr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

export function CourierWorkspace({
  establishmentId,
  courierName,
  availableOrders,
  myOrders,
  deliveredToday,
  stock,
  movements,
}: CourierWorkspaceProps) {
  useDeliveryOrdersLive(establishmentId, { chimeOnNew: true });
  const toast = useToast();
  const now = useNow();
  const [isPending, startTransition] = useTransition();
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(myOrders.length > 0 ? "mine" : "available");
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  const deliveredTodayValue = deliveredToday.reduce((sum, order) => sum + order.totalAmount, 0);
  const toCollectValue = myOrders.reduce((sum, order) => sum + order.totalAmount, 0);

  const sortedMyOrders = useMemo(
    () =>
      [...myOrders].sort(
        (a, b) =>
          new Date(a.acceptedAt ?? a.createdAt).getTime() -
          new Date(b.acceptedAt ?? b.createdAt).getTime(),
      ),
    [myOrders],
  );

  /** Stock libre (en main − réservé) par article, pour prévenir avant d'accepter. */
  const freeStock = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of stock) {
      map.set(line.productId, Math.max(line.quantity - line.reserved, 0));
    }
    return map;
  }, [stock]);

  function shortagesFor(order: DeliveryOrder): StockShortage[] {
    return order.items
      .map((item) => ({
        productName: item.productName,
        missing: item.quantity - (freeStock.get(item.productId) ?? 0),
      }))
      .filter((item) => item.missing > 0);
  }

  function run(
    orderId: string,
    action: (id: string) => Promise<ActionResult>,
    onSuccess?: () => void,
  ) {
    setBusyOrderId(orderId);
    startTransition(async () => {
      const result = await action(orderId);
      setBusyOrderId(null);
      setConfirm(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "C’est fait.");
      onSuccess?.();
    });
  }

  function submitConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirm) return;
    run(
      confirm.order.id,
      confirm.kind === "complete" ? completeDeliveryOrderAction : releaseDeliveryOrderAction,
    );
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "available", label: "À prendre", count: availableOrders.length },
    { id: "mine", label: "En cours", count: myOrders.length },
    { id: "delivered", label: "Livrées", count: deliveredToday.length },
    { id: "stock", label: "Mon stock", count: stock.length },
  ];

  const buttonBase =
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
  const primaryButton = `${buttonBase} bg-emerald-600 text-white shadow-sm active:bg-emerald-700 sm:hover:bg-emerald-700`;
  const secondaryButton = `${buttonBase} border border-slate-200 bg-white text-slate-600 active:bg-slate-50 sm:hover:bg-slate-50`;

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 pb-8 pt-4 sm:px-4 sm:pt-5">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900 sm:text-[24px]">
              Bonjour {firstName(courierName)}
            </h1>
            <p className="mt-0.5 text-[12px] text-slate-500 sm:text-[13px]">
              Acceptez une commande, livrez-la, puis confirmez la livraison.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            Réception en direct
          </span>
        </header>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-label="Résumé du jour">
          <StatCard
            icon={Inbox}
            tone="amber"
            label="À prendre"
            value={String(availableOrders.length)}
            hint="commandes en attente"
          />
          <StatCard
            icon={Truck}
            tone="sky"
            label="En cours"
            value={String(myOrders.length)}
            hint={myOrders.length > 0 ? `${formatPriceXof(toCollectValue)} à encaisser` : "aucune livraison"}
          />
          <StatCard
            icon={CheckCircle2}
            tone="emerald"
            label="Livrées"
            value={String(deliveredToday.length)}
            hint="aujourd’hui"
          />
          <StatCard
            icon={Wallet}
            tone="slate"
            label="Encaissé"
            value={formatPriceXof(deliveredTodayValue)}
            hint="aujourd’hui"
          />
        </section>

        <nav
          className="sticky top-0 z-10 -mx-3 bg-[#f4f6f8]/95 px-3 py-1 backdrop-blur sm:-mx-4 sm:px-4"
          aria-label="Sections"
        >
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist">
            {tabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[12px] font-semibold transition sm:flex-row sm:gap-1.5 sm:text-[13px] ${
                    active ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  <span
                    className={`min-w-5 rounded-full px-1.5 text-[10px] leading-4 tabular-nums ${
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {tab === "available" ? (
          <Section
            title="Commandes à prendre"
            description="La première personne qui accepte prend la commande. Les plus anciennes sont en haut."
          >
            {availableOrders.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Aucune commande en attente"
                text="Gardez cette page ouverte : un signal sonore vous prévient dès qu’une nouvelle commande arrive."
              />
            ) : (
              availableOrders.map((order) => (
                <CourierOrderCard
                  key={order.id}
                  order={order}
                  elapsedLabel={elapsedSince(order.createdAt, now, "Reçue")}
                  shortages={shortagesFor(order)}
                  actions={
                    <button
                      type="button"
                      onClick={() => run(order.id, acceptDeliveryOrderAction, () => setTab("mine"))}
                      disabled={isPending}
                      className={primaryButton}
                    >
                      <Hand className="h-4 w-4" />
                      {busyOrderId === order.id ? "Acceptation…" : "J’accepte"}
                    </button>
                  }
                />
              ))
            )}
          </Section>
        ) : null}

        {tab === "mine" ? (
          <Section
            title="Mes livraisons en cours"
            description="Une fois remise au client et payée, confirmez la livraison : votre stock est mis à jour."
          >
            {sortedMyOrders.length === 0 ? (
              <EmptyState
                icon={Truck}
                title="Aucune livraison en cours"
                text="Acceptez une commande dans l’onglet « À prendre » pour commencer."
              />
            ) : (
              sortedMyOrders.map((order) => (
                <CourierOrderCard
                  key={order.id}
                  order={order}
                  highlight
                  elapsedLabel={elapsedSince(order.acceptedAt ?? order.createdAt, now, "Acceptée")}
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "release", order })}
                        disabled={isPending}
                        className={secondaryButton}
                      >
                        <Undo2 className="h-4 w-4" />
                        Me désister
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "complete", order })}
                        disabled={isPending}
                        className={primaryButton}
                      >
                        <PackageCheck className="h-4 w-4" />
                        Livrée
                      </button>
                    </>
                  }
                />
              ))
            )}
          </Section>
        ) : null}

        {tab === "delivered" ? (
          <Section title="Livrées aujourd’hui" description="Récapitulatif de vos livraisons finalisées du jour.">
            {deliveredToday.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Aucune livraison finalisée aujourd’hui"
                text="Vos livraisons confirmées apparaîtront ici avec le montant encaissé."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <ul className="divide-y divide-slate-100">
                  {deliveredToday.map((order) => (
                    <li key={order.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-slate-900">
                          {formatDeliveryOrderNumber(order.orderNumber)}
                          {order.customerName ? (
                            <span className="font-normal text-slate-500"> · {order.customerName}</span>
                          ) : null}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          Livrée à {formatTimeFr(order.deliveredAt)}
                          {order.deliveryAddress ? ` · ${order.deliveryAddress}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-[14px] font-bold tabular-nums text-slate-900">
                        {formatPriceXof(order.totalAmount)}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-[13px]">
                  <span className="font-semibold text-slate-600">
                    Total · {deliveredToday.length} livraison{deliveredToday.length > 1 ? "s" : ""}
                  </span>
                  <span className="text-[15px] font-bold tabular-nums text-emerald-700">
                    {formatPriceXof(deliveredTodayValue)}
                  </span>
                </div>
              </div>
            )}
          </Section>
        ) : null}

        {tab === "stock" ? (
          <>
            <Section
              title="Mon stock de livraison"
              description="Articles remis par l’administrateur. « Réservé » = déjà engagé dans vos livraisons en cours."
            >
              {stock.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title="Aucun article en main"
                  text="L’administrateur doit vous remettre du stock avant que vous puissiez accepter des commandes."
                />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-[13px]">
                    <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Article</th>
                        <th className="px-2 py-2.5 text-right font-semibold">En main</th>
                        <th className="px-2 py-2.5 text-right font-semibold">Réservé</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Libre</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stock.map((line) => {
                        const free = Math.max(line.quantity - line.reserved, 0);
                        return (
                          <tr key={line.productId}>
                            <td className="px-4 py-3 font-medium text-slate-800">{line.productName}</td>
                            <td className="px-2 py-3 text-right tabular-nums">
                              {formatDeliveryQuantity(line.quantity)}
                            </td>
                            <td className="px-2 py-3 text-right tabular-nums text-sky-700">
                              {line.reserved > 0 ? formatDeliveryQuantity(line.reserved) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`inline-flex min-w-9 justify-center rounded-md px-1.5 py-0.5 text-[12px] font-bold tabular-nums ${
                                  free > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                }`}
                              >
                                {formatDeliveryQuantity(free)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Derniers mouvements" description="Remises, retours et livraisons sur votre stock.">
              {movements.length === 0 ? (
                <EmptyState icon={Boxes} title="Aucun mouvement" text="L’historique de votre stock apparaîtra ici." />
              ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {movements.map((movement) => (
                    <li key={movement.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
                          <Badge tone={MOVEMENT_TONES[movement.type]}>
                            {COURIER_MOVEMENT_LABELS[movement.type]}
                          </Badge>
                          <span className="truncate">{movement.productName}</span>
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {formatDateTimeFr(movement.createdAt)}
                          {movement.orderNumber !== null
                            ? ` · ${formatDeliveryOrderNumber(movement.orderNumber)}`
                            : ""}
                          {movement.note ? ` · ${movement.note}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`text-[14px] font-bold tabular-nums ${
                            movement.quantity > 0 ? "text-emerald-700" : "text-slate-700"
                          }`}
                        >
                          {movement.quantity > 0 ? "+" : "−"}
                          {formatDeliveryQuantity(Math.abs(movement.quantity))}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          reste {formatDeliveryQuantity(movement.quantityAfter)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        ) : null}
      </div>

      {confirm ? (
        <ModalShell
          formId="courier-confirm"
          compact
          title={
            confirm.kind === "complete"
              ? `Confirmer la livraison ${formatDeliveryOrderNumber(confirm.order.orderNumber)}`
              : `Se désister de ${formatDeliveryOrderNumber(confirm.order.orderNumber)}`
          }
          subtitle={
            confirm.kind === "complete"
              ? "La commande a été remise au client et le montant encaissé."
              : "La commande redeviendra disponible pour les autres livreurs."
          }
          onClose={() => {
            if (!isPending) setConfirm(null);
          }}
          onSubmit={submitConfirm}
          footer={
            <ModalFooter
              onCancel={() => setConfirm(null)}
              submitLabel={confirm.kind === "complete" ? "Oui, c’est livré" : "Oui, me désister"}
              pendingLabel="Enregistrement…"
              isPending={isPending}
            />
          }
        >
          {confirm.kind === "complete" ? (
            <div className="grid gap-2 text-[13px] text-slate-700">
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5">
                <span className="font-semibold text-emerald-900">Montant encaissé</span>
                <span className="text-[16px] font-bold tabular-nums text-emerald-800">
                  {formatPriceXof(confirm.order.totalAmount)}
                </span>
              </div>
              <p className="text-[12px] text-slate-500">
                Les articles livrés seront retirés de votre stock. Cette action est définitive.
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-slate-600">
              Les articles réservés pour cette commande seront libérés dans votre stock.
            </p>
          )}
        </ModalShell>
      ) : null}
    </div>
  );
}

type StatTone = "amber" | "sky" | "emerald" | "slate";

const STAT_TONES: Record<StatTone, string> = {
  amber: "bg-amber-50 text-amber-700",
  sky: "bg-sky-50 text-sky-700",
  emerald: "bg-emerald-50 text-emerald-700",
  slate: "bg-slate-100 text-slate-700",
};

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: StatTone;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${STAT_TONES[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[20px] font-bold leading-tight tabular-nums text-slate-900">{value}</p>
        <p className="truncate text-[11px] text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
        <p className="text-[12px] text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-[14px] font-semibold text-slate-800">{title}</p>
      <p className="max-w-sm text-[12px] text-slate-500">{text}</p>
    </div>
  );
}
