"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClipboardList, Search } from "lucide-react";

import { cancelOrderAction } from "@/app/(protected)/application/caisse/actions";
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
import type {
  AdminOrderDepartmentFilter,
  AdminOrderFiltersInput,
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
  cashiers: OrderCashierOption[];
  establishmentName: string;
  canManageOrders: boolean;
};

const DEPARTMENT_LABELS: Record<string, string> = {
  BAR: "Boissons",
  KITCHEN: "Cuisine",
};

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

  function applyFilters(next: Partial<AdminOrderFiltersInput>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.status && merged.status !== "all") params.set("status", merged.status);
    if (merged.department && merged.department !== "all")
      params.set("department", merged.department);
    if (merged.cashierId) params.set("cashierId", merged.cashierId);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.search) params.set("search", merged.search);
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
      router.refresh();
    });
  }

  const stats = [
    { title: "Total", value: String(totalOrders), subtitle: "commandes affichées" },
    { title: "En cours", value: String(openCount), subtitle: "ouvertes / à encaisser" },
    { title: "Terminées", value: String(paidCount), subtitle: "payées" },
    { title: "Chiffre d'affaires", value: formatPriceXof(totalRevenue), subtitle: "commandes payées" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3 lg:gap-3.5 lg:p-4">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
            Commandes
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {establishmentName} · supervision — {cancelledCount} annulée
            {cancelledCount > 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {message ? (
        <div className="shrink-0">
          <AlertMessage message={message} tone="success" />
        </div>
      ) : null}

      <div className="grid shrink-0 grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-sm"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {stat.title}
            </p>
            <p className="mt-1 text-[18px] font-bold text-slate-900">{stat.value}</p>
            <p className="text-[11px] text-slate-500">{stat.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            defaultValue={filters.search ?? ""}
            placeholder="Rechercher N°, table, caissière…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters({ search: (event.target as HTMLInputElement).value });
              }
            }}
          />
        </div>
        <select
          value={filters.status || "all"}
          onChange={(event) =>
            applyFilters({ status: event.target.value as AdminOrderStatusFilter })
          }
          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px]"
        >
          <option value="all">Tous statuts</option>
          <option value="OPEN">En cours</option>
          <option value="PAID">Terminées</option>
          <option value="CANCELLED">Annulées</option>
        </select>
        <select
          value={filters.department || "all"}
          onChange={(event) =>
            applyFilters({ department: event.target.value as AdminOrderDepartmentFilter })
          }
          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px]"
        >
          <option value="all">Tous départements</option>
          <option value="BAR">Boissons</option>
          <option value="KITCHEN">Cuisine</option>
        </select>
        <select
          value={filters.cashierId || ""}
          onChange={(event) => applyFilters({ cashierId: event.target.value })}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px]"
        >
          <option value="">Tous caissiers</option>
          {cashiers.map((cashier) => (
            <option key={cashier.id} value={cashier.id}>
              {cashier.fullName}
            </option>
          ))}
        </select>
        <input
          type="date"
          defaultValue={filters.from ?? ""}
          onChange={(event) => applyFilters({ from: event.target.value })}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px]"
        />
        <input
          type="date"
          defaultValue={filters.to ?? ""}
          onChange={(event) => applyFilters({ to: event.target.value })}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px]"
        />
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
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">N°</th>
                  <th className="px-3 py-2.5 font-semibold">Table / Réf.</th>
                  <th className="px-3 py-2.5 font-semibold">Département</th>
                  <th className="px-3 py-2.5 font-semibold">Caissier·ère</th>
                  <th className="px-3 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 font-semibold">Articles</th>
                  <th className="px-3 py-2.5 font-semibold">Total</th>
                  <th className="px-3 py-2.5 font-semibold">Statut</th>
                  <th className="px-3 py-2.5 font-semibold">Paiement</th>
                  <th className="px-3 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-emerald-700">
                      {formatOrderNumber(order.orderNumber)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {order.tableReference ?? order.customerReference ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
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
                    <td className="px-3 py-2.5 text-slate-600">{order.createdByName ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                      {new Date(order.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2.5">{order.itemCount}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      {formatPriceXof(order.totalAmount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="space-y-1">
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
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_PAYMENT_STATUS_STYLES[order.paymentStatus]}`}
                      >
                        {ORDER_PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
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
