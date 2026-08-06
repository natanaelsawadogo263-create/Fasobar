"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowDownToLine,
  Building2,
  Package,
  Pencil,
  Phone,
  Plus,
  Truck,
  Wallet,
} from "lucide-react";

import {
  createSupplierAction,
  recordStockEntryAction,
  toggleSupplierStatusAction,
  updateSupplierAction,
} from "@/app/(protected)/application/stock/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { StockEntryModal } from "@/components/stock/stock-entry-modal";
import {
  SupplierFormModal,
  type SupplierFormState,
} from "@/components/stock/supplier-form-modal";
import { formatPriceXof, formatQuantity } from "@/lib/stock/constants";
import type {
  RecentSupplyEntry,
  StockListItem,
  SupplierOption,
} from "@/lib/stock/types";
import type { ProductPackaging } from "@/lib/products/types";

type SupplyWorkspaceProps = {
  establishmentName: string;
  suppliers: SupplierOption[];
  stockItems: StockListItem[];
  recentEntries: RecentSupplyEntry[];
  packagingsByProduct?: Record<string, ProductPackaging[]>;
  canManageStock: boolean;
  /** Espace responsable bar : layout compact. */
  compact?: boolean;
};

type SupplierFormMode = "create" | "edit" | null;

const emptySupplierForm: SupplierFormState = {
  name: "",
  phone: "",
  address: "",
  active: true,
};

export function SupplyWorkspace({
  establishmentName,
  suppliers,
  stockItems,
  recentEntries,
  packagingsByProduct = {},
  canManageStock,
  compact = false,
}: SupplyWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [supplierFormMode, setSupplierFormMode] = useState<SupplierFormMode>(null);
  const [editingSupplier, setEditingSupplier] = useState<SupplierOption | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(emptySupplierForm);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<SupplierOption | null>(null);
  const [supplierFilter, setSupplierFilter] = useState<"all" | "active" | "inactive">("all");

  const barItems = useMemo(
    () => stockItems.filter((item) => item.active && item.departmentCode === "BAR"),
    [stockItems],
  );
  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.active),
    [suppliers],
  );
  const filteredSuppliers = useMemo(() => {
    if (supplierFilter === "active") return activeSuppliers;
    if (supplierFilter === "inactive") {
      return suppliers.filter((supplier) => !supplier.active);
    }
    return suppliers;
  }, [activeSuppliers, supplierFilter, suppliers]);

  const totalRecentCost = useMemo(
    () =>
      recentEntries.reduce(
        (sum, entry) => sum + (entry.totalCost !== null ? entry.totalCost : 0),
        0,
      ),
    [recentEntries],
  );

  function openCreateSupplier() {
    setEditingSupplier(null);
    setSupplierForm(emptySupplierForm);
    setSupplierError(null);
    setSupplierFormMode("create");
  }

  function openEditSupplier(supplier: SupplierOption) {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      active: supplier.active,
    });
    setSupplierError(null);
    setSupplierFormMode("edit");
  }

  function closeSupplierForm() {
    setSupplierFormMode(null);
    setEditingSupplier(null);
    setSupplierError(null);
  }

  async function handleEntrySubmit(formData: FormData) {
    setEntryError(null);
    startTransition(async () => {
      const result = await recordStockEntryAction({}, formData);
      if (result.error) {
        setEntryError(result.error);
        return;
      }
      setMessage(result.success ?? "Entrée enregistrée.");
      setShowEntryModal(false);
      router.refresh();
    });
  }

  async function handleSupplierSubmit(formData: FormData) {
    startTransition(async () => {
      const result =
        supplierFormMode === "edit"
          ? await updateSupplierAction({}, formData)
          : await createSupplierAction({}, formData);

      if (result.error) {
        setSupplierError(result.error);
        return;
      }

      setMessage(result.success ?? "Opération réussie.");
      closeSupplierForm();
      router.refresh();
    });
  }

  async function handleReactivateSupplier(supplier: SupplierOption) {
    startTransition(async () => {
      const result = await toggleSupplierStatusAction(supplier.id, true, true);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMessage(result.success ?? "Fournisseur réactivé.");
      setError(null);
      router.refresh();
    });
  }

  async function handleToggleSupplier(active: boolean, confirmed = true) {
    if (!deactivateTarget) {
      return;
    }

    startTransition(async () => {
      const result = await toggleSupplierStatusAction(
        deactivateTarget.id,
        active,
        confirmed,
      );

      if (result.error) {
        setError(result.error);
        setDeactivateTarget(null);
        return;
      }

      setMessage(result.success ?? "Statut mis à jour.");
      setError(null);
      setDeactivateTarget(null);
      router.refresh();
    });
  }

  const canCreateEntry =
    canManageStock && barItems.length > 0 && activeSuppliers.length > 0;

  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden ${
        compact
          ? "gap-3 px-4 py-4 lg:gap-4 lg:px-6 lg:py-5"
          : "gap-3 px-4 py-3 lg:gap-3.5 lg:px-5 lg:py-4"
      }`}
    >
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
            Approvisionnements
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {compact ? (
              <>
                {recentEntries.length} entrée
                {recentEntries.length > 1 ? "s" : ""} récente
                {recentEntries.length > 1 ? "s" : ""}
                {activeSuppliers.length > 0 ? (
                  <span>
                    {" "}
                    · {activeSuppliers.length} fournisseur
                    {activeSuppliers.length > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-orange-600"> · aucun fournisseur actif</span>
                )}
              </>
            ) : (
              <>
                Achats boissons ·{" "}
                <span className="font-medium text-slate-700">
                  {establishmentName}
                </span>
              </>
            )}
          </p>
        </div>

        {canManageStock ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCreateSupplier}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              Fournisseur
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryError(null);
                setShowEntryModal(true);
              }}
              disabled={isPending || !canCreateEntry}
              title={
                barItems.length === 0
                  ? "Créez d'abord des produits bar"
                  : activeSuppliers.length === 0
                    ? "Ajoutez d'abord un fournisseur"
                    : undefined
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Nouvelle entrée
            </button>
          </div>
        ) : null}
      </header>

      {(error || message) && (
        <div className="shrink-0 space-y-2">
          {error ? <AlertMessage message={error} /> : null}
          {message ? <AlertMessage message={message} tone="success" /> : null}
        </div>
      )}

      <div
        className={`grid shrink-0 gap-2.5 ${
          compact ? "grid-cols-3 lg:gap-3" : "grid-cols-2 lg:grid-cols-4 lg:gap-3"
        }`}
      >
        <StatCard
          title={compact ? "Fournisseurs" : "Fournisseurs actifs"}
          value={String(activeSuppliers.length)}
          subtitle={
            compact
              ? `${suppliers.length} au total`
              : `${suppliers.length} au total`
          }
          icon={Building2}
          tone="sky"
          compact={compact}
        />
        <StatCard
          title={compact ? "Entrées" : "Entrées récentes"}
          value={String(recentEntries.length)}
          subtitle={compact ? "récentes" : "derniers achats enregistrés"}
          icon={Truck}
          tone="emerald"
          compact={compact}
        />
        <StatCard
          title={compact ? "Montant" : "Montant récent"}
          value={formatPriceXof(totalRecentCost)}
          subtitle={compact ? "récent" : "coût des entrées listées"}
          icon={Wallet}
          tone="amber"
          compact={compact}
        />
        {!compact ? (
          <StatCard
            title="Articles bar"
            value={String(barItems.length)}
            subtitle="disponibles pour entrée"
            icon={Package}
            tone="slate"
          />
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.85fr)] lg:gap-3.5">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-slate-900">
                Entrées récentes
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
                {recentEntries.length}
              </span>
            </div>
          </div>

          <div className="app-scroll min-h-0 flex-1 overflow-auto">
            {recentEntries.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Truck className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-3 text-[13px] font-semibold text-slate-900">
                  Aucune entrée enregistrée
                </h3>
                <p className="mt-1 max-w-sm text-[12px] text-slate-500">
                  Enregistrez une livraison fournisseur pour voir l&apos;historique.
                </p>
                {canManageStock ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEntryError(null);
                      setShowEntryModal(true);
                    }}
                    disabled={!canCreateEntry}
                    className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Nouvelle entrée
                  </button>
                ) : null}
              </div>
            ) : (
              <table className="min-w-full text-left text-[12px]">
                <thead className="sticky top-0 z-10 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur">
                  <tr>
                    <th className="px-3.5 py-2.5 font-medium">Date</th>
                    <th className="px-3.5 py-2.5 font-medium">Article</th>
                    <th className="px-3.5 py-2.5 font-medium">Fournisseur</th>
                    <th className="px-3.5 py-2.5 font-medium">Qté</th>
                    <th className="px-3.5 py-2.5 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="text-slate-700 hover:bg-slate-50/70"
                    >
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-slate-500">
                        {new Date(entry.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <p className="font-semibold text-slate-900">
                          {entry.stockItemName}
                        </p>
                        {entry.reference ? (
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Réf. {entry.reference}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        {entry.supplierName ?? "—"}
                      </td>
                      <td className="px-3.5 py-2.5 tabular-nums text-slate-700">
                        {formatQuantity(entry.quantity, entry.unit)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                        {entry.totalCost !== null
                          ? formatPriceXof(entry.totalCost)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-slate-900">
                Fournisseurs
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
                {filteredSuppliers.length}
              </span>
            </div>
            <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
              {(
                [
                  ["all", "Tous"],
                  ["active", "Actifs"],
                  ["inactive", "Inactifs"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSupplierFilter(value)}
                  className={`h-7 rounded-md px-2 text-[10px] font-semibold transition ${
                    supplierFilter === value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="app-scroll min-h-0 flex-1 overflow-auto">
            {filteredSuppliers.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-12 text-center">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                  <Building2 className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-3 text-[13px] font-semibold text-slate-900">
                  {suppliers.length === 0
                    ? "Aucun fournisseur"
                    : "Aucun résultat"}
                </h3>
                <p className="mt-1 text-[12px] text-slate-500">
                  {suppliers.length === 0
                    ? "Ajoutez un fournisseur avant une entrée."
                    : "Changez le filtre pour afficher d'autres."}
                </p>
                {canManageStock && suppliers.length === 0 ? (
                  <button
                    type="button"
                    onClick={openCreateSupplier}
                    className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredSuppliers.map((supplier) => (
                  <li
                    key={supplier.id}
                    className="px-3.5 py-2.5 hover:bg-slate-50/70"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[13px] font-semibold text-slate-900">
                            {supplier.name}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              supplier.active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {supplier.active ? "Actif" : "Inactif"}
                          </span>
                        </div>
                        <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                          {supplier.phone ? (
                            <p className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{supplier.phone}</span>
                            </p>
                          ) : (
                            <p>Pas de téléphone</p>
                          )}
                          {supplier.address ? (
                            <p className="truncate">{supplier.address}</p>
                          ) : null}
                        </div>
                      </div>

                      {canManageStock ? (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditSupplier(supplier)}
                            title="Modifier"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          {supplier.active ? (
                            <button
                              type="button"
                              onClick={() => setDeactivateTarget(supplier)}
                              className="text-[11px] font-medium text-slate-400 hover:text-slate-700"
                            >
                              Désactiver
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleReactivateSupplier(supplier)}
                              className="text-[11px] font-medium text-emerald-700 hover:underline disabled:opacity-60"
                            >
                              Réactiver
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {showEntryModal && canManageStock ? (
        <StockEntryModal
          stockItems={barItems}
          suppliers={activeSuppliers}
          packagingsByProduct={packagingsByProduct}
          formError={entryError}
          isPending={isPending}
          drinksOnly
          onClose={() => setShowEntryModal(false)}
          onSubmit={handleEntrySubmit}
        />
      ) : null}

      {supplierFormMode && canManageStock ? (
        <SupplierFormModal
          mode={supplierFormMode}
          formState={supplierForm}
          editingSupplier={editingSupplier}
          formError={supplierError}
          onClose={closeSupplierForm}
          onSubmit={handleSupplierSubmit}
          onChange={setSupplierForm}
        />
      ) : null}

      {deactivateTarget?.active && canManageStock ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setDeactivateTarget(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="deactivate-supplier-title"
            className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="deactivate-supplier-title"
              className="text-lg font-semibold text-slate-900"
            >
              Désactiver ce fournisseur ?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              « {deactivateTarget.name} » ne sera plus proposé lors des nouvelles
              entrées. L&apos;historique reste conservé.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeactivateTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleToggleSupplier(false, true)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Désactivation..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "amber" | "sky" | "slate";
  compact?: boolean;
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
  compact = false,
}: StatCardProps) {
  const toneClasses = {
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-orange-50 text-orange-600",
    sky: "bg-sky-50 text-sky-600",
    slate: "bg-slate-100 text-slate-600",
  };

  if (compact) {
    return (
      <article className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/80">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {title}
            </p>
            <p className="truncate text-[15px] font-bold tabular-nums text-slate-900 lg:text-[16px]">
              {value}
            </p>
            <p className="truncate text-[10px] text-slate-400">{subtitle}</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-500">{title}</p>
          <p className="mt-0.5 truncate text-[16px] font-bold tracking-tight tabular-nums text-slate-900 lg:text-[17px]">
            {value}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
        </div>
      </div>
    </article>
  );
}
