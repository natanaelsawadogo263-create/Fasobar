"use client";

import { useMemo, useState } from "react";
import { Download, Eye, History } from "lucide-react";

import type { BarHistoryRow } from "@/lib/bar/constants";
import { BAR_HISTORY_TYPE_LABELS } from "@/lib/bar/constants";
import type { BarHistoryTypeFilter } from "@/lib/bar/schemas";
import { formatQuantity, PRODUCT_UNIT_LABELS } from "@/lib/stock/constants";
import { ModalShell } from "@/components/ui/modal-shell";

type BarHistoryWorkspaceProps = {
  rows: BarHistoryRow[];
  products: Array<{ id: string; name: string }>;
  initialProductId?: string;
};

const TYPE_DOT: Record<BarHistoryRow["displayType"], string> = {
  entry: "bg-emerald-500",
  loss: "bg-red-500",
  inventory: "bg-sky-500",
  correction: "bg-orange-500",
};

const QTY_TONE: Record<BarHistoryRow["displayType"], string> = {
  entry: "text-emerald-700",
  loss: "text-red-600",
  inventory: "text-sky-700",
  correction: "text-orange-700",
};

const PAGE_SIZE = 14;

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function quantityLabel(row: BarHistoryRow): string {
  const unit =
    PRODUCT_UNIT_LABELS[row.unit as keyof typeof PRODUCT_UNIT_LABELS] ?? row.unit;
  const abs = Math.abs(row.quantity);
  const formatted = formatQuantity(abs, row.unit);

  if (row.displayType === "inventory") {
    const delta = row.quantityAfter - row.quantityBefore;
    return `Écart ${delta > 0 ? "+" : ""}${delta}`;
  }
  if (row.displayType === "entry" || row.quantity > 0) {
    return `+${formatted}`;
  }
  return `-${unit ? formatted : abs}`;
}

export function BarHistoryWorkspace({
  rows,
  products,
  initialProductId = "",
}: BarHistoryWorkspaceProps) {
  const [productId, setProductId] = useState(initialProductId);
  const [type, setType] = useState<BarHistoryTypeFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<BarHistoryRow | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (productId && row.stockItemId !== productId) return false;
      if (type !== "all" && row.displayType !== type) return false;
      if (from) {
        const start = new Date(`${from}T00:00:00`);
        if (new Date(row.createdAt) < start) return false;
      }
      if (to) {
        const end = new Date(`${to}T23:59:59`);
        if (new Date(row.createdAt) > end) return false;
      }
      return true;
    });
  }, [rows, productId, type, from, to]);

  const typeCounts = useMemo(() => {
    const counts = { entry: 0, loss: 0, inventory: 0, correction: 0 };
    for (const row of rows) {
      counts[row.displayType] += 1;
    }
    return counts;
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function exportCsv() {
    const header = ["Date", "Produit", "Type", "Quantité", "Auteur", "Détail"];
    const lines = filtered.map((row) =>
      [
        formatDateTime(row.createdAt),
        row.productName,
        BAR_HISTORY_TYPE_LABELS[row.displayType],
        quantityLabel(row),
        row.authorName ?? "",
        row.reason ?? row.reference ?? "",
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(";"),
    );
    const blob = new Blob([[header.join(";"), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `historique-bar-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const typeFilters: Array<{ id: BarHistoryTypeFilter; label: string }> = [
    { id: "all", label: "Tous" },
    { id: "entry", label: "Entrées" },
    { id: "loss", label: "Pertes" },
    { id: "inventory", label: "Inventaire" },
    { id: "correction", label: "Corrections" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden px-4 py-4 lg:gap-4 lg:px-6 lg:py-5">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
            Historique
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {rows.length} mouvement{rows.length > 1 ? "s" : ""}
            {filtered.length !== rows.length ? (
              <span>
                {" "}
                · {filtered.length} affiché{filtered.length > 1 ? "s" : ""}
              </span>
            ) : null}
            {typeCounts.entry > 0 || typeCounts.loss > 0 ? (
              <span className="text-slate-400">
                {" "}
                · {typeCounts.entry} entrée{typeCounts.entry > 1 ? "s" : ""}
                {typeCounts.loss > 0
                  ? ` · ${typeCounts.loss} perte${typeCounts.loss > 1 ? "s" : ""}`
                  : ""}
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          Exporter CSV
        </button>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-slate-100 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-0.5 self-start">
            {typeFilters.map((filter) => {
              const active = type === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => {
                    setType(filter.id);
                    setPage(1);
                  }}
                  className={`h-7 rounded-md px-2.5 text-[11px] font-semibold transition ${
                    active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setPage(1);
              }}
              className="h-8 min-w-[160px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[12px] text-slate-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15 sm:max-w-xs"
            >
              <option value="">Tous les produits</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[12px] text-slate-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
              aria-label="Du"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[12px] text-slate-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
              aria-label="Au"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {pageRows.length === 0 ? (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center px-4 text-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <History className="h-5 w-5" />
              </span>
              <p className="mt-2.5 text-[13px] font-medium text-slate-700">
                Aucun mouvement
              </p>
              <p className="mt-0.5 text-[12px] text-slate-400">
                Modifiez les filtres ou enregistrez une opération stock.
              </p>
            </div>
          ) : (
            <table className="min-w-full text-left text-[12px]">
              <thead className="sticky top-0 z-10 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur">
                <tr>
                  <th className="px-3.5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Produit</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Qté</th>
                  <th className="px-3 py-2.5 font-medium">Auteur</th>
                  <th className="px-3.5 py-2.5 text-right font-medium">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-slate-500">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-slate-900">
                        {row.productName}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[row.displayType]}`}
                        />
                        {BAR_HISTORY_TYPE_LABELS[row.displayType]}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2.5 font-semibold tabular-nums ${QTY_TONE[row.displayType]}`}
                    >
                      {quantityLabel(row)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {row.authorName ?? "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setDetail(row)}
                        title="Voir le détail"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > 0 ? (
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-3.5 py-2">
            <p className="text-[11px] text-slate-400">
              Page {currentPage} / {pageCount}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 rounded-lg border border-slate-200 px-3 text-[12px] font-medium text-slate-600 disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                type="button"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="h-8 rounded-lg border border-slate-200 px-3 text-[12px] font-medium text-slate-600 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {detail ? (
        <ModalShell
          title={detail.productName}
          subtitle={BAR_HISTORY_TYPE_LABELS[detail.displayType]}
          onClose={() => setDetail(null)}
          footer={
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-[13px] font-semibold text-white hover:bg-emerald-500"
            >
              Fermer
            </button>
          }
        >
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <dt className="text-slate-500">Date</dt>
              <dd className="font-medium text-slate-900">
                {formatDateTime(detail.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Quantité</dt>
              <dd className={`font-semibold ${QTY_TONE[detail.displayType]}`}>
                {quantityLabel(detail)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Avant → Après</dt>
              <dd className="font-medium text-slate-900">
                {detail.quantityBefore} → {detail.quantityAfter}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Auteur</dt>
              <dd className="font-medium text-slate-900">
                {detail.authorName ?? "—"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Détail</dt>
              <dd className="font-medium text-slate-900">
                {detail.reason || detail.reference || "—"}
              </dd>
            </div>
          </dl>
        </ModalShell>
      ) : null}
    </div>
  );
}
