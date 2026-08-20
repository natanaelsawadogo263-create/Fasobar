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
  RotateCcw,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";

import {
  createSupplierAction,
  deleteSupplyReceiptDraftAction,
  getSupplyReceiptAction,
  reopenSupplyReceiptAction,
  saveSupplyReceiptAction,
  toggleSupplierStatusAction,
  updateSupplierAction,
} from "@/app/(protected)/application/stock/actions";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { AlertMessage } from "@/components/auth/alert-message";
import { SupplyReceiptModal } from "@/components/stock/supply-receipt-modal";
import {
  SupplierFormModal,
  type SupplierFormState,
} from "@/components/stock/supplier-form-modal";
import { getActivityPages } from "@/lib/activity/pages";
import { isRetailActivity } from "@/lib/activity/profile";
import { formatPriceXof, formatQuantity } from "@/lib/stock/constants";
import { resolveOrderPeriodRange, toLocalIsoDate } from "@/lib/orders/period";
import type {
  RecentSupplyEntry,
  StockListItem,
  SupplierOption,
  SupplyReceiptDetail,
  SupplyReceiptListItem,
} from "@/lib/stock/types";
import type { ProductPackaging } from "@/lib/products/types";
import {
  allowedDepartments,
  defaultDepartmentCode,
  type ServiceScope,
} from "@/lib/settings/service-scope";

type SupplyDepartment = "BAR" | "KITCHEN";
type SupplyPeriodFilter = "day" | "week" | "month" | "custom";

type SupplyWorkspaceProps = {
  establishmentName: string;
  suppliers: SupplierOption[];
  stockItems: StockListItem[];
  recentEntries: RecentSupplyEntry[];
  receipts?: SupplyReceiptListItem[] | null;
  packagingsByProduct?: Record<string, ProductPackaging[]>;
  canManageStock: boolean;
  /** Admin uniquement : réouvrir un appro validé pour le modifier. */
  canReopenSupply?: boolean;
  /** Espace responsable bar : layout compact. */
  compact?: boolean;
  /** Si défini, l'écran est figé sur cet espace (ex. Bar). */
  lockedDepartment?: SupplyDepartment | null;
  serviceScope?: ServiceScope;
  periodFilter?: SupplyPeriodFilter | null;
  periodFrom?: string;
  periodTo?: string;
  periodLabel?: string | null;
  periodBasePath?: string;
  activityCode?: string | null;
};

type SupplierFormMode = "create" | "edit" | null;

const SPACE_LABELS: Record<SupplyDepartment, string> = {
  BAR: "Bar",
  KITCHEN: "Cuisine",
};

const PERIOD_OPTIONS: Array<{ id: SupplyPeriodFilter; label: string }> = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
];

function SupplyStatusBadge({ status }: { status: "DRAFT" | "VALIDATED" }) {
  if (status === "DRAFT") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/80">
        Brouillon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200/80">
      Validé
    </span>
  );
}

const emptySupplierForm = (departmentCode: SupplyDepartment): SupplierFormState => ({
  name: "",
  phone: "",
  address: "",
  departmentCode,
  active: true,
});

export function SupplyWorkspace({
  establishmentName,
  suppliers,
  stockItems,
  recentEntries,
  receipts,
  packagingsByProduct = {},
  canManageStock,
  canReopenSupply = false,
  compact = false,
  lockedDepartment = null,
  serviceScope = "BOTH",
  periodFilter = "day",
  periodFrom,
  periodTo,
  periodLabel = null,
  periodBasePath = "/application/approvisionnements",
  activityCode = null,
}: SupplyWorkspaceProps) {
  void establishmentName;
  void periodLabel;
  const retail = isRetailActivity(activityCode);
  const activityPages = getActivityPages(activityCode);
  const supplyPages = activityPages.supply;
  const spaceLabels: Record<SupplyDepartment, string> = retail
    ? { BAR: activityPages.expenses.barArea, KITCHEN: activityPages.expenses.caisseArea }
    : SPACE_LABELS;
  const router = useRouter();
  const availableDepartments = lockedDepartment
    ? [lockedDepartment]
    : allowedDepartments(serviceScope);
  const initialDepartment =
    lockedDepartment ?? defaultDepartmentCode(serviceScope);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<SupplyReceiptDetail | null>(null);
  const [supplierFormMode, setSupplierFormMode] = useState<SupplierFormMode>(null);
  const [editingSupplier, setEditingSupplier] = useState<SupplierOption | null>(null);
  const [departmentFilter, setDepartmentFilter] =
    useState<SupplyDepartment>(initialDepartment);
  const activeDepartment = lockedDepartment ?? departmentFilter;
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(() =>
    emptySupplierForm(initialDepartment),
  );
  const [entryError, setEntryError] = useState<string | null>(null);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<SupplierOption | null>(null);
  const [supplierFilter, setSupplierFilter] = useState<"all" | "active" | "inactive">("all");

  function applyPeriodFilters(next: {
    period?: SupplyPeriodFilter;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();
    const nextPeriod =
      next.period ??
      (next.from !== undefined || next.to !== undefined
        ? "custom"
        : periodFilter ?? "day");

    if (nextPeriod !== "custom") {
      const range = resolveOrderPeriodRange(nextPeriod, toLocalIsoDate(new Date()));
      params.set("period", nextPeriod);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
    } else {
      params.set("period", "custom");
      const from = next.from ?? periodFrom;
      const to = next.to ?? periodTo;
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }

    router.push(`${periodBasePath}?${params.toString()}`);
  }

  const departmentItems = useMemo(
    () =>
      stockItems.filter(
        (item) => item.active && item.departmentCode === activeDepartment,
      ),
    [stockItems, activeDepartment],
  );
  const departmentSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.departmentCode === activeDepartment),
    [suppliers, activeDepartment],
  );
  const activeSuppliers = useMemo(
    () => departmentSuppliers.filter((supplier) => supplier.active),
    [departmentSuppliers],
  );
  const filteredSuppliers = useMemo(() => {
    if (supplierFilter === "active") return activeSuppliers;
    if (supplierFilter === "inactive") {
      return departmentSuppliers.filter((supplier) => !supplier.active);
    }
    return departmentSuppliers;
  }, [activeSuppliers, departmentSuppliers, supplierFilter]);

  const departmentEntries = useMemo(
    () =>
      recentEntries.filter((entry) => entry.departmentCode === activeDepartment),
    [recentEntries, activeDepartment],
  );

  const totalRecentCost = useMemo(
    () =>
      departmentEntries.reduce(
        (sum, entry) => sum + (entry.totalCost !== null ? entry.totalCost : 0),
        0,
      ),
    [departmentEntries],
  );
  const departmentReceipts = useMemo(() => {
    if (!receipts) return null;
    return receipts.filter(
      (item) =>
        item.departmentCodes.length === 0 ||
        item.departmentCodes.includes(activeDepartment),
    );
  }, [receipts, activeDepartment]);
  const totalReceiptCost = useMemo(
    () =>
      (departmentReceipts ?? [])
        .filter((item) => item.status === "VALIDATED")
        .reduce((sum, item) => sum + item.totalAmount, 0),
    [departmentReceipts],
  );
  const historyCount =
    departmentReceipts !== null ? departmentReceipts.length : departmentEntries.length;
  const historyTotal = departmentReceipts !== null ? totalReceiptCost : totalRecentCost;

  function openCreateSupplier() {
    setEditingSupplier(null);
    setSupplierForm(emptySupplierForm(activeDepartment));
    setSupplierError(null);
    setSupplierFormMode("create");
  }

  function openEditSupplier(supplier: SupplierOption) {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      departmentCode: supplier.departmentCode,
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

  async function handleReceiptSave(payload: {
    receiptId?: string;
    supplierId: string;
    receivedOn: string;
    notes?: string;
    validate: boolean;
    lines: Array<{
      stockItemId: string;
      productId: string | null;
      unitLevelId: string | null;
      unitName: string;
      purchasedQuantity: number;
      conversionFactor: number;
      stockQuantity: number;
      purchasePrice: number;
      lineTotal: number;
    }>;
  }) {
    setEntryError(null);
    startTransition(async () => {
      const result = await saveSupplyReceiptAction(payload);
      if (result.error) {
        setEntryError(result.error);
        return;
      }
      setMessage(result.success ?? "Approvisionnement enregistré.");
      setShowEntryModal(false);
      setEditingReceipt(null);
      refreshSoon(() => router.refresh());
    });
  }

  async function handleOpenDraft(receipt: SupplyReceiptListItem) {
    if (receipt.status !== "DRAFT" || !canManageStock) return;
    setEntryError(null);
    startTransition(async () => {
      const result = await getSupplyReceiptAction(receipt.id);
      if (result.error || !result.receipt) {
        setError(result.error ?? "Impossible d’ouvrir ce brouillon.");
        return;
      }
      if (result.receipt.status !== "DRAFT") {
        setError("Cet approvisionnement est déjà validé.");
        return;
      }
      setEditingReceipt(result.receipt);
      setShowEntryModal(true);
    });
  }

  async function handleReopenValidated(receipt: SupplyReceiptListItem) {
    if (receipt.status !== "VALIDATED" || !canReopenSupply) return;
    const confirmed = window.confirm(
      "Réouvrir cet approvisionnement pour le modifier ?\n\nLe stock ajouté par cette entrée sera retiré. Vous pourrez ensuite corriger et revalider.",
    );
    if (!confirmed) return;

    setEntryError(null);
    setError(null);
    startTransition(async () => {
      const reopen = await reopenSupplyReceiptAction(receipt.id);
      if (reopen.error) {
        setError(reopen.error);
        return;
      }
      const result = await getSupplyReceiptAction(receipt.id);
      if (result.error || !result.receipt) {
        setError(result.error ?? "Approvisionnement réouvert, mais impossible de l’ouvrir.");
        refreshSoon(() => router.refresh());
        return;
      }
      setMessage(reopen.success ?? "Approvisionnement réouvert.");
      setEditingReceipt(result.receipt);
      setShowEntryModal(true);
      refreshSoon(() => router.refresh());
    });
  }

  function openNewReceipt() {
    setEditingReceipt(null);
    setEntryError(null);
    setShowEntryModal(true);
  }

  async function handleDeleteDraft(receiptId: string) {
    startTransition(async () => {
      const result = await deleteSupplyReceiptDraftAction(receiptId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Brouillon supprimé.");
      refreshSoon(() => router.refresh());
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
      refreshSoon(() => router.refresh());
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
      refreshSoon(() => router.refresh());
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
      refreshSoon(() => router.refresh());
    });
  }

  const canCreateEntry =
    canManageStock && departmentItems.length > 0 && activeSuppliers.length > 0;

  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden ${
        lockedDepartment ? "items-center bg-slate-50/80" : ""
      }`}
    >
      <div
        className={`flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden ${
          lockedDepartment ? "max-w-5xl" : ""
        } ${
          compact
            ? "gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-4 lg:gap-4 lg:px-6 lg:py-5"
            : "gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:gap-3.5 lg:px-5 lg:py-4"
        }`}
      >
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[20px] lg:text-[22px]">
            Approvisionnements
          </h1>
          <p className="mt-0.5 hidden text-[12px] text-slate-500 sm:block">
            {compact ? (
              <>
                {departmentEntries.length} entrée
                {departmentEntries.length > 1 ? "s" : ""} récente
                {departmentEntries.length > 1 ? "s" : ""}
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
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:hidden">
            {historyCount} entrée
            {historyCount > 1 ? "s" : ""}
            <span className="text-slate-300"> · </span>
            {activeSuppliers.length} fournisseur
            {activeSuppliers.length > 1 ? "s" : ""}
          </p>
        </div>

        {canManageStock ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={openCreateSupplier}
              disabled={isPending}
              title="Ajouter un fournisseur"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-60 sm:h-9 sm:px-3.5 sm:hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Fournisseur</span>
            </button>
            <button
              type="button"
              onClick={openNewReceipt}
              disabled={isPending || !canCreateEntry}
              title={
                departmentItems.length === 0
                  ? `Créez d'abord des articles ${spaceLabels[activeDepartment].toLowerCase()}`
                  : activeSuppliers.length === 0
                    ? "Ajoutez d'abord un fournisseur pour cet espace"
                    : undefined
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white shadow-sm active:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:px-3.5 sm:hover:bg-emerald-500"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span className="sm:hidden">Entrée</span>
              <span className="hidden sm:inline">Nouvelle entrée</span>
            </button>
          </div>
        ) : null}
      </header>

      {/* Filtres : période + dates, comme Dépenses */}
      <div className="-mx-1 flex shrink-0 flex-wrap items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => applyPeriodFilters({ period: option.id })}
              className={`inline-flex h-9 shrink-0 items-center rounded-md px-2.5 text-[12px] font-semibold transition sm:h-8 sm:text-[11px] ${
                periodFilter === option.id
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 active:bg-slate-50 sm:hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-500 sm:h-8">
          Du
          <input
            type="date"
            value={periodFrom ?? ""}
            onChange={(event) => applyPeriodFilters({ from: event.target.value })}
            className="h-7 min-w-[8.5rem] border-0 bg-transparent px-0 text-[12px] text-slate-800 outline-none"
          />
        </label>
        <label className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-500 sm:h-8">
          Au
          <input
            type="date"
            value={periodTo ?? ""}
            onChange={(event) => applyPeriodFilters({ to: event.target.value })}
            className="h-7 min-w-[8.5rem] border-0 bg-transparent px-0 text-[12px] text-slate-800 outline-none"
          />
        </label>
        {!lockedDepartment && availableDepartments.length > 1
          ? availableDepartments.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setDepartmentFilter(code)}
                className={`inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-[12px] font-semibold transition sm:h-8 ${
                  activeDepartment === code
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                    : "bg-slate-100 text-slate-600 active:bg-slate-200"
                }`}
              >
                {spaceLabels[code]}
              </button>
            ))
          : null}
      </div>

      {error ? <AlertMessage message={error} /> : null}
      {message ? (
        <AlertMessage
          message={message}
          tone="success"
          onDismiss={() => setMessage(null)}
        />
      ) : null}

      {/* KPI mobile : bandeau horizontal */}
      <div className="-mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 md:hidden">
        <div className="w-[40%] min-w-[8rem] shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Fournisseurs
          </p>
          <p className="mt-0.5 truncate text-[15px] font-bold tabular-nums text-slate-900">
            {activeSuppliers.length}
          </p>
        </div>
        <div className="w-[40%] min-w-[8rem] shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Entrées
          </p>
          <p className="mt-0.5 truncate text-[15px] font-bold tabular-nums text-slate-900">
            {historyCount}
          </p>
        </div>
        <div className="w-[40%] min-w-[8rem] shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Montant
          </p>
          <p className="mt-0.5 truncate text-[15px] font-bold tabular-nums text-slate-900">
            {formatPriceXof(historyTotal)}
          </p>
        </div>
        {!compact && !retail ? (
          <div className="w-[40%] min-w-[8rem] shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Articles
            </p>
            <p className="mt-0.5 truncate text-[15px] font-bold tabular-nums text-slate-900">
              {departmentItems.length}
            </p>
          </div>
        ) : null}
      </div>

      {/* KPI desktop */}
      <div
        className={`hidden shrink-0 gap-2 md:grid ${
          compact
            ? "grid-cols-3"
            : retail
              ? "grid-cols-3"
              : "grid-cols-2 lg:grid-cols-4"
        }`}
      >
        <StatCard
          title={compact ? "Fournisseurs" : "Fournisseurs actifs"}
          value={String(activeSuppliers.length)}
          icon={Building2}
          tone="sky"
        />
        <StatCard
          title={compact ? "Entrées" : "Entrées récentes"}
          value={String(historyCount)}
          icon={Truck}
          tone="emerald"
        />
        <StatCard
          title={compact ? "Montant" : "Montant récent"}
          value={formatPriceXof(historyTotal)}
          icon={Wallet}
          tone="amber"
        />
        {!compact && !retail ? (
          <StatCard
            title={`Articles ${spaceLabels[activeDepartment].toLowerCase()}`}
            value={String(departmentItems.length)}
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
                {historyCount}
              </span>
            </div>
          </div>

          <div className="app-scroll min-h-0 flex-1 overflow-auto">
            {historyCount === 0 ? (
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
                    onClick={openNewReceipt}
                    disabled={!canCreateEntry}
                    className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white active:bg-emerald-500 disabled:opacity-60 sm:h-9 sm:hover:bg-emerald-500"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Nouvelle entrée
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div className="space-y-2 p-2.5 md:hidden">
                  {departmentReceipts !== null
                    ? departmentReceipts.map((receipt) => {
                        const canEditDraft =
                          receipt.status === "DRAFT" && canManageStock;
                        const canReopen =
                          receipt.status === "VALIDATED" && canReopenSupply;
                        return (
                          <article
                            key={receipt.id}
                            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-[14px] font-semibold text-slate-900">
                                    {receipt.supplierName}
                                  </p>
                                  <SupplyStatusBadge status={receipt.status} />
                                </div>
                                <p className="mt-1 text-[12px] text-slate-500">
                                  {new Date(
                                    `${receipt.receivedOn}T12:00:00`,
                                  ).toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                  <span className="text-slate-300"> · </span>
                                  {receipt.lineCount} produit
                                  {receipt.lineCount > 1 ? "s" : ""}
                                </p>
                              </div>
                              <p className="shrink-0 text-[14px] font-bold tabular-nums text-slate-900">
                                {formatPriceXof(receipt.totalAmount)}
                              </p>
                            </div>

                            {canEditDraft || canReopen ? (
                              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2.5">
                                {canEditDraft ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void handleOpenDraft(receipt)}
                                      className="inline-flex h-10 min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white active:bg-emerald-700"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Modifier
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDraft(receipt.id)}
                                      className="inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-[12px] font-semibold text-red-700 active:bg-red-50"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Supprimer
                                    </button>
                                  </>
                                ) : null}
                                {canReopen ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleReopenValidated(receipt)}
                                    className="inline-flex h-10 min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[12px] font-semibold text-slate-800 active:bg-slate-100"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Réouvrir et modifier
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </article>
                        );
                      })
                    : departmentEntries.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-slate-900">
                            {entry.stockItemName}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {new Date(entry.createdAt).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                            })}
                            <span className="text-slate-300"> · </span>
                            {entry.supplierName ?? "—"}
                          </p>
                          {entry.reference ? (
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              Réf. {entry.reference}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[13px] font-bold tabular-nums text-slate-900">
                            {entry.totalCost !== null
                              ? formatPriceXof(entry.totalCost)
                              : "—"}
                          </p>
                          <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                            {formatQuantity(entry.quantity, entry.unit)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Desktop : tableau */}
                <table className="hidden min-w-full text-left text-[12px] md:table">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur">
                    <tr>
                      <th className="px-3.5 py-2.5 font-medium">Date</th>
                      <th className="px-3.5 py-2.5 font-medium">Fournisseur</th>
                      <th className="px-3.5 py-2.5 font-medium">Produits</th>
                      <th className="px-3.5 py-2.5 font-medium">Statut</th>
                      <th className="px-3.5 py-2.5 text-right font-medium">Montant</th>
                      {canManageStock || canReopenSupply ? (
                        <th className="px-3.5 py-2.5 text-right font-medium">Actions</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {departmentReceipts !== null
                      ? departmentReceipts.map((receipt) => {
                          const canEditDraft =
                            receipt.status === "DRAFT" && canManageStock;
                          const canReopen =
                            receipt.status === "VALIDATED" && canReopenSupply;
                          return (
                          <tr
                            key={receipt.id}
                            className="text-slate-700 hover:bg-slate-50/70"
                          >
                            <td className="whitespace-nowrap px-3.5 py-3 text-slate-500">
                              {new Date(`${receipt.receivedOn}T12:00:00`).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-3.5 py-3 font-semibold text-slate-900">
                              {receipt.supplierName}
                            </td>
                            <td className="px-3.5 py-3 tabular-nums text-slate-700">
                              {receipt.lineCount}
                            </td>
                            <td className="px-3.5 py-3">
                              <SupplyStatusBadge status={receipt.status} />
                            </td>
                            <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-slate-900">
                              {formatPriceXof(receipt.totalAmount)}
                            </td>
                            {canManageStock || canReopenSupply ? (
                              <td className="px-3.5 py-3">
                                <div className="flex items-center justify-end gap-1.5">
                                  {canEditDraft ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => void handleOpenDraft(receipt)}
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                      >
                                        <Pencil className="h-3 w-3" />
                                        Modifier
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDraft(receipt.id)}
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        Supprimer
                                      </button>
                                    </>
                                  ) : null}
                                  {canReopen ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleReopenValidated(receipt)}
                                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                      Réouvrir
                                    </button>
                                  ) : null}
                                  {!canEditDraft && !canReopen ? (
                                    <span className="text-[11px] text-slate-400">—</span>
                                  ) : null}
                                </div>
                              </td>
                            ) : null}
                          </tr>
                          );
                        })
                      : departmentEntries.map((entry) => (
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
                        {canManageStock || canReopenSupply ? (
                          <td className="px-3.5 py-2.5 text-right text-slate-400">—</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 sm:px-3.5">
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
                  className={`inline-flex h-8 shrink-0 items-center rounded-md px-2.5 text-[11px] font-semibold transition sm:h-7 sm:px-2 sm:text-[10px] ${
                    supplierFilter === value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 active:text-slate-700 sm:hover:text-slate-700"
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
                  {departmentSuppliers.length === 0
                    ? "Aucun fournisseur"
                    : "Aucun résultat"}
                </h3>
                <p className="mt-1 text-[12px] text-slate-500">
                  {departmentSuppliers.length === 0
                    ? `Ajoutez un fournisseur ${spaceLabels[activeDepartment].toLowerCase()} avant une entrée.`
                    : "Changez le filtre pour afficher d'autres."}
                </p>
                {canManageStock && departmentSuppliers.length === 0 ? (
                  <button
                    type="button"
                    onClick={openCreateSupplier}
                    className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white active:bg-emerald-500 sm:h-8 sm:px-3 sm:hover:bg-emerald-500"
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
                          <span className="inline-flex rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                            {spaceLabels[supplier.departmentCode]}
                          </span>
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
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditSupplier(supplier)}
                            title="Modifier"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition active:border-emerald-200 active:bg-emerald-50 active:text-emerald-800 sm:h-8 sm:w-8 sm:rounded-md sm:hover:border-emerald-200 sm:hover:bg-emerald-50 sm:hover:text-emerald-800"
                          >
                            <Pencil className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                          </button>
                          {supplier.active ? (
                            <button
                              type="button"
                              onClick={() => setDeactivateTarget(supplier)}
                              className="inline-flex h-10 items-center rounded-lg px-2.5 text-[12px] font-medium text-slate-500 active:bg-slate-100 sm:h-8 sm:px-0 sm:text-[11px] sm:hover:text-slate-700"
                            >
                              Désactiver
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleReactivateSupplier(supplier)}
                              className="inline-flex h-10 items-center rounded-lg px-2.5 text-[12px] font-medium text-emerald-700 active:bg-emerald-50 disabled:opacity-60 sm:h-8 sm:px-0 sm:text-[11px] sm:hover:underline"
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
        <SupplyReceiptModal
          key={editingReceipt?.id ?? "new"}
          stockItems={departmentItems}
          suppliers={activeSuppliers}
          packagingsByProduct={packagingsByProduct}
          initialDraft={editingReceipt}
          formError={entryError}
          isPending={isPending}
          onClose={() => {
            setShowEntryModal(false);
            setEditingReceipt(null);
            setEntryError(null);
          }}
          onSave={handleReceiptSave}
        />
      ) : null}

      {supplierFormMode && canManageStock ? (
        <SupplierFormModal
          mode={supplierFormMode}
          formState={supplierForm}
          editingSupplier={editingSupplier}
          formError={supplierError}
          lockedDepartment={
            lockedDepartment ??
            (availableDepartments.length === 1 ? availableDepartments[0] : null)
          }
          hideDepartment={retail}
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
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "amber" | "sky" | "slate";
};

function StatCard({ title, value, icon: Icon, tone }: StatCardProps) {
  const toneClasses = {
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-orange-50 text-orange-600",
    sky: "bg-sky-50 text-sky-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <article className="rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${toneClasses[tone]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {title}
        </p>
      </div>
      <p className="mt-1 truncate text-[16px] font-bold tabular-nums text-slate-900">{value}</p>
    </article>
  );
}
