"use client";

import { useMemo, useState, useTransition } from "react";
import { Lock, Minus, Plus, Search, Send, Trash2, Wallet } from "lucide-react";

import {
  cancelDeliveryOrderAction,
  createDeliveryOrderAction,
} from "@/app/(protected)/application/livraisons/actions";
import { DeliveryCashModal } from "@/components/delivery/delivery-cash-modal";
import { DeliveryHistoryPanel } from "@/components/delivery/delivery-history-panel";
import type { DeliveryPeriodValue } from "@/components/delivery/delivery-period-filter";
import { DeliveryOrderCard } from "@/components/delivery/delivery-order-card";
import { InstantLink } from "@/components/layout/instant-link";
import { useToast } from "@/components/ui/toast";
import { useDeliveryOrdersLive } from "@/hooks/use-delivery-orders-live";
import {
  deliveryNetToCash,
  deliveryOrderStage,
  type DeliveryOrderStage,
} from "@/lib/delivery/constants";
import type { DeliveryOrder, DeliveryProductOption } from "@/lib/delivery/types";
import { formatPriceXof } from "@/lib/products/constants";

type DeliveryDeskWorkspaceProps = {
  establishmentId: string;
  products: DeliveryProductOption[];
  orders: DeliveryOrder[];
  /** Session de caisse ouverte : obligatoire pour encaisser. */
  hasOpenCashSession: boolean;
  /** Formulaire « Nouvelle commande » (masqué pour l'admin : la caisse commande depuis le POS). */
  showOrderForm: boolean;
  /** Admin : livraisons effectuées sur la période choisie (vue « Livraisons effectuées »). */
  history?: {
    period: DeliveryPeriodValue;
    orders: DeliveryOrder[];
    /** Ouvrir directement cette vue (lien avec une période dans l'URL). */
    initiallyOpen: boolean;
  };
};

type DeskView = "live" | "history";

type CartLine = { productId: string; quantity: number };

const TABS: Array<{ id: DeliveryOrderStage; label: string }> = [
  { id: "PENDING", label: "En attente" },
  { id: "ACCEPTED", label: "En cours" },
  { id: "TO_CASH", label: "À encaisser" },
  { id: "CASHED", label: "Encaissées" },
  { id: "CANCELLED", label: "Annulées" },
];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

export function DeliveryDeskWorkspace({
  establishmentId,
  products,
  orders,
  hasOpenCashSession,
  showOrderForm,
  history,
}: DeliveryDeskWorkspaceProps) {
  const [view, setView] = useState<DeskView>(history?.initiallyOpen ? "history" : "live");
  useDeliveryOrdersLive(establishmentId);
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<DeliveryOrderStage>("PENDING");
  const [cashing, setCashing] = useState<DeliveryOrder | null>(null);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => product.name.toLowerCase().includes(term));
  }, [products, search]);

  const total = cart.reduce((sum, line) => {
    const product = productById.get(line.productId);
    return sum + (product ? Math.round(product.sellingPrice * line.quantity) : 0);
  }, 0);

  const counts = useMemo(() => {
    const result: Record<DeliveryOrderStage, number> = {
      PENDING: 0,
      ACCEPTED: 0,
      TO_CASH: 0,
      CASHED: 0,
      CANCELLED: 0,
    };
    for (const order of orders) result[deliveryOrderStage(order)] += 1;
    return result;
  }, [orders]);

  const visibleOrders = orders.filter((order) => deliveryOrderStage(order) === tab);
  const toCashTotal = orders
    .filter((order) => deliveryOrderStage(order) === "TO_CASH")
    .reduce((sum, order) => sum + deliveryNetToCash(order), 0);

  function addProduct(productId: string) {
    setCart((current) => {
      const existing = current.find((line) => line.productId === productId);
      if (existing) {
        return current.map((line) =>
          line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { productId, quantity: 1 }];
    });
  }

  function setQuantity(productId: string, quantity: number) {
    setCart((current) =>
      quantity <= 0
        ? current.filter((line) => line.productId !== productId)
        : current.map((line) => (line.productId === productId ? { ...line, quantity } : line)),
    );
  }

  function resetForm() {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryAddress("");
    setNote("");
  }

  function submitOrder() {
    if (cart.length === 0 || isPending) return;
    startTransition(async () => {
      const result = await createDeliveryOrderAction({
        items: cart,
        customerName,
        customerPhone,
        deliveryAddress,
        note,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Commande envoyée.");
      resetForm();
      setTab("PENDING");
    });
  }

  function cancelOrder(orderId: string) {
    const reason = window.prompt("Motif de l’annulation (optionnel) :");
    if (reason === null) return;
    startTransition(async () => {
      const result = await cancelDeliveryOrderAction({ orderId, reason });
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "Commande annulée.");
    });
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:gap-5 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
            Livraisons
          </h1>
          {history ? (
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist">
              {(
                [
                  { id: "live", label: "Suivi en cours" },
                  { id: "history", label: "Livraisons effectuées" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={view === item.id}
                  onClick={() => setView(item.id)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                    view === item.id ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {history && view === "history" ? (
          <DeliveryHistoryPanel period={history.period} orders={history.orders} />
        ) : (
        <>
        {counts.TO_CASH > 0 ? (
          <button
            type="button"
            onClick={() => setTab("TO_CASH")}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-left transition hover:bg-orange-100"
          >
            <span className="flex items-center gap-2 text-[13px] font-semibold text-orange-900">
              <Wallet className="h-4 w-4" />
              {counts.TO_CASH} commande{counts.TO_CASH > 1 ? "s" : ""} livrée
              {counts.TO_CASH > 1 ? "s" : ""} à encaisser
            </span>
            <span className="text-[15px] font-bold tabular-nums text-orange-900">
              {formatPriceXof(toCashTotal)}
            </span>
          </button>
        ) : null}

        <div
          className={`grid gap-4 ${showOrderForm ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}
        >
          {/* Nouvelle commande */}
          {showOrderForm ? (
          <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <h2 className="text-[15px] font-semibold text-slate-900">Nouvelle commande</h2>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un article…"
                className={`${inputClass} pl-9`}
              />
            </label>

            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
              {filteredProducts.length === 0 ? (
                <li className="px-3 py-4 text-center text-[13px] text-slate-500">
                  Aucun article trouvé.
                </li>
              ) : (
                filteredProducts.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(product.id)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] transition hover:bg-emerald-50 active:bg-emerald-100"
                    >
                      <span className="min-w-0 truncate font-medium text-slate-800">
                        {product.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-slate-600">
                        {formatPriceXof(product.sellingPrice)}
                        <Plus className="h-4 w-4 text-emerald-600" />
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>

            {cart.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {cart.map((line) => {
                  const product = productById.get(line.productId);
                  if (!product) return null;
                  return (
                    <li
                      key={line.productId}
                      className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px]"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                        {product.name}
                      </span>
                      <button
                        type="button"
                        aria-label="Diminuer"
                        onClick={() => setQuantity(line.productId, line.quantity - 1)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) =>
                          setQuantity(line.productId, Number(event.target.value) || 0)
                        }
                        className="input-no-spinner h-8 w-14 rounded-lg border border-slate-200 bg-white text-center text-sm"
                      />
                      <button
                        type="button"
                        aria-label="Augmenter"
                        onClick={() => setQuantity(line.productId, line.quantity + 1)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Retirer"
                        onClick={() => setQuantity(line.productId, 0)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[13px] text-slate-500">
                Touchez un article pour l’ajouter à la commande.
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Nom du client (optionnel)"
                className={inputClass}
              />
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Téléphone (optionnel)"
                inputMode="tel"
                className={inputClass}
              />
              <input
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                placeholder="Adresse de livraison (optionnel)"
                className={`${inputClass} sm:col-span-2`}
              />
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Note pour le livreur (optionnel)"
                className={`${inputClass} sm:col-span-2`}
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <p className="text-[15px] font-bold text-slate-900">
                Total : {formatPriceXof(total)}
              </p>
              <button
                type="button"
                onClick={submitOrder}
                disabled={cart.length === 0 || isPending}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-[14px] font-semibold text-white shadow-sm transition active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:hover:bg-emerald-700"
              >
                <Send className="h-4 w-4" />
                {isPending ? "Envoi…" : "Commander"}
              </button>
            </div>
          </section>
          ) : null}

          {/* Suivi */}
          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                    tab === item.id
                      ? "bg-emerald-600 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {item.label} ({counts[item.id]})
                </button>
              ))}
            </div>

            {tab === "TO_CASH" && !hasOpenCashSession ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="flex items-center gap-2 text-[13px] font-medium text-amber-900">
                  <Lock className="h-4 w-4" />
                  Ouvrez votre session de caisse pour encaisser.
                </p>
                <InstantLink
                  href="/application/caisse/session"
                  className="inline-flex h-9 items-center rounded-lg bg-amber-600 px-3 text-[13px] font-semibold text-white transition hover:bg-amber-700"
                >
                  Ouvrir la session
                </InstantLink>
              </div>
            ) : null}

            {visibleOrders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-[13px] text-slate-500">
                Aucune commande ici.
              </p>
            ) : (
              visibleOrders.map((order) => (
                <DeliveryOrderCard
                  key={order.id}
                  order={order}
                  showCourier
                  actions={
                    deliveryOrderStage(order) === "TO_CASH" ? (
                      <button
                        type="button"
                        onClick={() => setCashing(order)}
                        disabled={!hasOpenCashSession}
                        title={hasOpenCashSession ? undefined : "Ouvrez votre session de caisse"}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-sm transition active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:hover:bg-emerald-700"
                      >
                        <Wallet className="h-4 w-4" />
                        Encaisser
                      </button>
                    ) : order.status === "PENDING" || order.status === "ACCEPTED" ? (
                      <button
                        type="button"
                        onClick={() => cancelOrder(order.id)}
                        disabled={isPending}
                        className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        Annuler
                      </button>
                    ) : null
                  }
                />
              ))
            )}
          </section>
        </div>
        </>
        )}
      </div>

      {cashing ? <DeliveryCashModal order={cashing} onClose={() => setCashing(null)} /> : null}
    </div>
  );
}
