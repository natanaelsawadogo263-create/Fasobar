"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Wallet, X } from "lucide-react";

import {
  cancelExpenseAction,
  createExpenseAction,
  updateExpenseAction,
} from "@/app/(protected)/application/depenses/actions";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { AlertMessage } from "@/components/auth/alert-message";
import { ModalFooter } from "@/components/ui/modal-footer";
import {
  FormSection,
  NumberField,
  SelectField,
  TextField,
} from "@/components/ui/form-controls";
import {
  EXPENSE_AREA_LABELS,
  EXPENSE_AREA_STYLES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_STYLES,
  formatPriceXof,
} from "@/lib/expenses/constants";
import type {
  ExpenseArea,
  ExpenseCategory,
  ExpenseFiltersInput,
} from "@/lib/expenses/schemas";
import type { ExpenseListItem } from "@/lib/expenses/types";
import { resolveOrderPeriodRange, toLocalIsoDate } from "@/lib/orders/period";
import { hasBarService, type ServiceScope } from "@/lib/settings/service-scope";

type ExpensePeriodFilter = "day" | "week" | "month";

type ExpensesWorkspaceProps = {
  expenses: ExpenseListItem[];
  periodTotal: number;
  recordedCount: number;
  cancelledCount: number;
  kitchenTotal: number;
  caisseTotal: number;
  barTotal: number;
  filters: ExpenseFiltersInput;
  establishmentName: string;
  /** Si défini, l'espace ne voit / crée que cette zone (CAISSE ou BAR). */
  lockedArea?: ExpenseArea | null;
  periodFilter?: ExpensePeriodFilter | null;
  periodLabel?: string | null;
  canManage?: boolean;
  serviceScope?: ServiceScope;
};

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS);
const AREA_OPTIONS = Object.entries(EXPENSE_AREA_LABELS);
const PERIOD_OPTIONS: Array<{ id: ExpensePeriodFilter; label: string }> = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpensesWorkspace({
  expenses,
  periodTotal,
  recordedCount,
  cancelledCount,
  kitchenTotal: _kitchenTotal,
  caisseTotal,
  barTotal,
  filters,
  establishmentName,
  lockedArea = null,
  periodFilter = null,
  periodLabel = null,
  canManage = true,
  serviceScope = "BOTH",
}: ExpensesWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | "cancel" | null>(null);
  const [selected, setSelected] = useState<ExpenseListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const showBarArea = hasBarService(serviceScope);

  function openCreate() {
    setSelected(null);
    setFormError(null);
    setModal("create");
  }

  function openEdit(item: ExpenseListItem) {
    setSelected(item);
    setFormError(null);
    setModal("edit");
  }

  function openCancel(item: ExpenseListItem) {
    setSelected(item);
    setFormError(null);
    setModal("cancel");
  }

  function applyFilters(
    next: Partial<ExpenseFiltersInput> & { period?: ExpensePeriodFilter },
  ) {
    const params = new URLSearchParams();
    const merged = { ...filters, ...next };
    const nextPeriod = next.period ?? periodFilter;

    if (merged.area) params.set("area", merged.area);
    if (merged.category) params.set("category", merged.category);
    if (merged.status && merged.status !== "all") params.set("status", merged.status);
    if (merged.search) params.set("search", merged.search);

    if (lockedArea && nextPeriod) {
      const range = resolveOrderPeriodRange(nextPeriod, toLocalIsoDate(new Date()));
      params.set("period", nextPeriod);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
    } else {
      if (merged.from) params.set("from", merged.from);
      if (merged.to) params.set("to", merged.to);
    }

    router.push(`/application/depenses?${params.toString()}`);
  }

  function handleFormAction(formData: FormData) {
    setFormError(null);
    setMessage(null);
    startTransition(async () => {
      const result =
        modal === "edit" && selected
          ? await updateExpenseAction({}, formData)
          : await createExpenseAction({}, formData);

      if (result.error) {
        setFormError(result.error);
        return;
      }
      setMessage(result.success ?? "Enregistré.");
      setModal(null);
      refreshSoon(() => router.refresh());
    });
  }

  function handleCancelAction(formData: FormData) {
    setFormError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await cancelExpenseAction({}, formData);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setMessage(result.success ?? "Annulée.");
      setModal(null);
      refreshSoon(() => router.refresh());
    });
  }

  const stats = useMemo(() => {
    if (lockedArea === "CAISSE") {
      return [
        {
          title: "Total période",
          value: formatPriceXof(caisseTotal),
          subtitle: periodLabel ?? "dépenses actives",
        },
        {
          title: "Enregistrées",
          value: String(recordedCount),
          subtitle: `${cancelledCount} annulée${cancelledCount > 1 ? "s" : ""}`,
        },
      ];
    }
    if (lockedArea === "BAR") {
      return [
        {
          title: "Total période",
          value: formatPriceXof(barTotal),
          subtitle: periodLabel ?? "dépenses actives",
        },
        {
          title: "Enregistrées",
          value: String(recordedCount),
          subtitle: `${cancelledCount} annulée${cancelledCount > 1 ? "s" : ""}`,
        },
      ];
    }
    return [
      {
        title: "Total période",
        value: formatPriceXof(periodTotal),
        subtitle: "dépenses actives",
      },
      {
        title: "Liées à la caisse",
        value: formatPriceXof(caisseTotal),
        subtitle: "service caisse",
      },
      ...(showBarArea
        ? [
            {
              title: "Liées au bar",
              value: formatPriceXof(barTotal),
              subtitle: "service bar",
            },
          ]
        : []),
      {
        title: "Enregistrées",
        value: String(recordedCount),
        subtitle: `${cancelledCount} annulée${cancelledCount > 1 ? "s" : ""}`,
      },
    ];
  }, [
    lockedArea,
    periodLabel,
    periodTotal,
    caisseTotal,
    barTotal,
    recordedCount,
    cancelledCount,
    showBarArea,
  ]);

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden ${
        lockedArea ? "items-center bg-slate-50/80" : ""
      }`}
    >
      <div
        className={`flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden p-3 lg:gap-3.5 lg:p-4 ${
          lockedArea ? "max-w-3xl" : ""
        }`}
      >
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
            Dépenses
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {establishmentName}
            {lockedArea
              ? ` · dépenses ${EXPENSE_AREA_LABELS[lockedArea].toLowerCase()}`
              : " · charges réelles, sans modification du stock boissons"}
            {periodLabel ? (
              <>
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="capitalize">{periodLabel}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {lockedArea && periodFilter ? (
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => applyFilters({ period: option.id })}
                  className={`h-8 rounded-md px-2.5 text-[11px] font-semibold transition ${
                    periodFilter === option.id
                      ? "bg-emerald-600 text-white"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
          {canManage ? (
            <button
              type="button"
              onClick={openCreate}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouvelle dépense
            </button>
          ) : null}
        </div>
      </header>

      {message ? (
        <AlertMessage
          message={message}
          tone="success"
          onDismiss={() => setMessage(null)}
        />
      ) : null}

      <div className={`grid shrink-0 gap-2.5 ${stats.length === 2 ? "grid-cols-2 lg:grid-cols-2" : "grid-cols-2 lg:grid-cols-4"} lg:gap-3`}>
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
        <div className="relative min-w-0 flex-1 basis-full sm:min-w-[200px] sm:basis-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            defaultValue={filters.search ?? ""}
            placeholder={
              lockedArea ? "Rechercher un titre…" : "Rechercher libellé, fournisseur…"
            }
            className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 sm:h-9 sm:text-[12px]"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters({ search: (event.target as HTMLInputElement).value });
              }
            }}
          />
        </div>
        {!lockedArea ? (
          <select
            value={filters.area || ""}
            onChange={(event) =>
              applyFilters({ area: event.target.value as ExpenseArea | "" })
            }
            className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] sm:h-9 sm:flex-none sm:text-[12px]"
          >
            <option value="">Caisse & Bar</option>
            {AREA_OPTIONS.filter(([value]) => showBarArea || value !== "BAR").map(
              ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
            )}
          </select>
        ) : null}
        {!lockedArea ? (
          <select
            value={filters.category || ""}
            onChange={(event) =>
              applyFilters({ category: event.target.value as ExpenseCategory | "" })
            }
            className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] sm:h-9 sm:flex-none sm:text-[12px]"
          >
            <option value="">Toutes catégories</option>
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : null}
        <select
          value={filters.status || "all"}
          onChange={(event) =>
            applyFilters({ status: event.target.value as ExpenseFiltersInput["status"] })
          }
          className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] sm:h-9 sm:flex-none sm:text-[12px]"
        >
          <option value="all">Tous statuts</option>
          <option value="RECORDED">Enregistrées</option>
          <option value="CANCELLED">Annulées</option>
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        {expenses.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Wallet className="h-6 w-6" />
            </div>
            <h2 className="mt-3 text-[15px] font-semibold text-slate-900">Aucune dépense</h2>
            <p className="mt-1 max-w-sm text-[12px] text-slate-500">
              Enregistrez les achats Cuisine et les autres charges. Cela n&apos;affecte jamais le
              stock boissons.
            </p>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <div className="space-y-2 p-3 md:hidden">
              {expenses.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-slate-900">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        {new Intl.DateTimeFormat("fr-FR").format(
                          new Date(item.expenseDate),
                        )}
                        {!lockedArea
                          ? ` · ${EXPENSE_CATEGORY_LABELS[item.category]}`
                          : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-[14px] font-bold tabular-nums text-slate-900">
                      {formatPriceXof(item.amount)}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {!lockedArea ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${EXPENSE_AREA_STYLES[item.area]}`}
                      >
                        {EXPENSE_AREA_LABELS[item.area]}
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${EXPENSE_STATUS_STYLES[item.status]}`}
                    >
                      {EXPENSE_STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  {item.status === "RECORDED" ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 text-[12px] font-semibold text-emerald-700 active:bg-emerald-50"
                        onClick={() => openEdit(item)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 text-[12px] font-semibold text-red-600 active:bg-red-50"
                        onClick={() => openCancel(item)}
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-400">Verrouillée</p>
                  )}
                </article>
              ))}
            </div>

            <table className="hidden min-w-full text-left text-[12px] md:table">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Date</th>
                  {!lockedArea ? (
                    <th className="px-3 py-2.5 font-semibold">Rattachée à</th>
                  ) : null}
                  {!lockedArea ? (
                    <th className="px-3 py-2.5 font-semibold">Catégorie</th>
                  ) : null}
                  <th className="px-3 py-2.5 font-semibold">
                    {lockedArea ? "Titre" : "Libellé"}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Montant</th>
                  <th className="px-3 py-2.5 font-semibold">Statut</th>
                  <th className="px-3 py-2.5 font-semibold">Auteur</th>
                  <th className="px-3 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                      {new Intl.DateTimeFormat("fr-FR").format(new Date(item.expenseDate))}
                    </td>
                    {!lockedArea ? (
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${EXPENSE_AREA_STYLES[item.area]}`}
                        >
                          {EXPENSE_AREA_LABELS[item.area]}
                        </span>
                      </td>
                    ) : null}
                    {!lockedArea ? (
                      <td className="px-3 py-2.5 text-slate-700">
                        {EXPENSE_CATEGORY_LABELS[item.category]}
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 font-medium text-slate-900">{item.label}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      {formatPriceXof(item.amount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${EXPENSE_STATUS_STYLES[item.status]}`}
                      >
                        {EXPENSE_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{item.createdByName ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {item.status === "RECORDED" ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-emerald-700 hover:underline"
                            onClick={() => openEdit(item)}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-red-600 hover:underline"
                            onClick={() => openCancel(item)}
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400" title={item.cancelReason ?? ""}>
                          Verrouillée
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === "create" || modal === "edit" ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4">
          <form
            action={handleFormAction}
            className="flex max-h-[min(92dvh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold text-slate-900">
                  {modal === "edit" ? "Modifier la dépense" : "Nouvelle dépense"}
                </h2>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Montants en XOF entiers. Aucun impact sur le stock boissons.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg p-1 hover:bg-slate-100"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {formError ? <AlertMessage message={formError} /> : null}
              {selected ? <input type="hidden" name="expenseId" value={selected.id} /> : null}
              <FormSection title="Informations">
                {lockedArea ? (
                  <input type="hidden" name="area" value={lockedArea} />
                ) : (
                  <SelectField
                    id="area"
                    name="area"
                    label="Rattachée à"
                    defaultValue={selected?.area ?? "CAISSE"}
                    required
                  >
                    {AREA_OPTIONS.filter(([value]) => showBarArea || value !== "BAR").map(
                      ([value, label]) => (
                      <option key={value} value={value}>
                        {label === "Caisse"
                          ? "Caisse — dépenses liées à la caisse"
                          : "Bar — dépenses liées au bar"}
                      </option>
                    ),
                    )}
                  </SelectField>
                )}
                {lockedArea ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                    Zone :{" "}
                    <span className="font-semibold text-slate-900">
                      {EXPENSE_AREA_LABELS[lockedArea]}
                    </span>
                  </p>
                ) : null}
                {!lockedArea ? (
                  <SelectField
                    id="category"
                    name="category"
                    label="Catégorie"
                    defaultValue={selected?.category ?? "KITCHEN_PURCHASE"}
                    required
                  >
                    {CATEGORY_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SelectField>
                ) : (
                  <input
                    type="hidden"
                    name="category"
                    value={selected?.category ?? "OTHER"}
                  />
                )}
                <TextField
                  id="label"
                  name="label"
                  label={lockedArea ? "Titre" : "Libellé"}
                  defaultValue={selected?.label ?? ""}
                  placeholder={
                    lockedArea ? "Ex. Achat gaz" : "Ex. Sac de riz 50 kg"
                  }
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    id="amount"
                    name="amount"
                    label="Montant (XOF)"
                    defaultValue={selected ? String(selected.amount) : ""}
                    required
                  />
                  <TextField
                    id="expenseDate"
                    name="expenseDate"
                    type="date"
                    label="Date"
                    defaultValue={selected?.expenseDate ?? todayIso()}
                    required
                  />
                </div>
              </FormSection>
            </div>
            <div className="border-t border-slate-100 px-5 py-3">
              <ModalFooter
                onCancel={() => setModal(null)}
                submitLabel={modal === "edit" ? "Enregistrer" : "Créer la dépense"}
              />
            </div>
          </form>
        </div>
      ) : null}

      {modal === "cancel" && selected ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4">
          <form
            action={handleCancelAction}
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-[16px] font-bold text-slate-900">Annuler la dépense</h2>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {selected.label} · {formatPriceXof(selected.amount)}. L&apos;historique est
                conservé.
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              {formError ? <AlertMessage message={formError} /> : null}
              <input type="hidden" name="expenseId" value={selected.id} />
              <TextField
                id="reason"
                name="reason"
                label="Motif obligatoire"
                placeholder="Ex. saisie en double"
                required
              />
            </div>
            <div className="border-t border-slate-100 px-5 py-3">
              <ModalFooter onCancel={() => setModal(null)} submitLabel="Confirmer l'annulation" />
            </div>
          </form>
        </div>
      ) : null}
      </div>
    </div>
  );
}
