"use client";

import type {
  ComputedAmountLine,
  ComputedFuelLine,
  ComputedShopLine,
  ComputedStationSheet,
  ComputedSummaryRow,
  FuelLineId,
  SheetManualPath,
  StationFieldKind,
} from "@/lib/station/sheet-engine";
import { formatPriceXof } from "@/lib/products/constants";

export type { SheetManualPath };

type StationSessionSheetProps = {
  stationName: string;
  managerName?: string;
  pompisteName: string;
  openedAt: string;
  computed: ComputedStationSheet;
  activeFuelLineId: FuelLineId;
  onManualChange?: (path: SheetManualPath, value: number | string) => void;
  readOnly?: boolean;
};

type CellField = {
  value: number | string;
  kind: StationFieldKind;
  editable: boolean;
};

function cellTone(kind: StationFieldKind, editable: boolean): string {
  if (kind === "calculated") return "bg-sky-50/80 text-slate-900";
  if (kind === "carry_forward" && !editable) return "bg-slate-100 text-slate-700";
  return "bg-white text-slate-900";
}

function formatLiters(value: number): string {
  if (value === 0) return "";
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

function formatMoney(value: number): string {
  if (value === 0) return "";
  return formatPriceXof(value);
}

function formatSummaryValue(value: number, unit: "L" | "FCFA"): string {
  return unit === "L" ? formatLiters(value) : formatMoney(value);
}

function SheetNumCell({
  field,
  onChange,
  readOnly,
  money = false,
  step = "0.001",
}: {
  field: CellField & { value: number };
  onChange?: (value: number) => void;
  readOnly?: boolean;
  money?: boolean;
  step?: string;
}) {
  const editable = field.editable && !readOnly && onChange;
  const tone = cellTone(field.kind, field.editable);

  if (!editable) {
    return (
      <td className={`border border-slate-400 px-1 py-0.5 text-right text-[10px] ${tone}`}>
        {money ? formatMoney(field.value) : formatLiters(field.value)}
      </td>
    );
  }

  return (
    <td className={`border border-slate-400 p-0 ${tone}`}>
      <input
        type="number"
        min={0}
        step={step}
        value={Number.isFinite(field.value) ? field.value : 0}
        onChange={(e) => onChange?.(Number(e.target.value) || 0)}
        className="h-7 w-full bg-transparent px-1 text-right text-[10px] outline-none focus:bg-emerald-50/60"
      />
    </td>
  );
}

function SheetTextCell({
  field,
  onChange,
  readOnly,
  placeholder,
}: {
  field: CellField & { value: string };
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  const editable = field.editable && !readOnly && onChange;
  const tone = cellTone(field.kind, field.editable);

  if (!editable) {
    return (
      <td className={`border border-slate-400 px-1 py-0.5 text-[10px] ${tone}`}>
        {field.value || "—"}
      </td>
    );
  }

  return (
    <td className={`border border-slate-400 p-0 ${tone}`}>
      <input
        type="text"
        value={field.value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-7 w-full bg-transparent px-1 text-[10px] outline-none focus:bg-emerald-50/60"
      />
    </td>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 border border-slate-500 bg-slate-100 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide">
      {children}
    </p>
  );
}

function ShopTable({
  title,
  rows,
  venteTotale,
  section,
  onManualChange,
  readOnly,
}: {
  title: string;
  rows: ComputedShopLine[];
  venteTotale: number;
  section: "lubricants" | "gas" | "divers";
  onManualChange?: StationSessionSheetProps["onManualChange"];
  readOnly?: boolean;
}) {
  return (
    <div className="mb-2">
      <SectionTitle>{title}</SectionTitle>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-slate-50">
            {[
              "LIBELLES",
              "DESIGNATIONS",
              "STOCK OUVERTURE (1)",
              "QUANTITE RECUE (2)",
              "STOCK TOTAL (1+2)",
              "BTE P.U (3)",
              "P.U NET (4)",
              "VENTE DU JOUR (5)",
              "STOCK EN FIN DU JOUR (1+2-5)",
            ].map((h) => (
              <th key={h} className="border border-slate-400 px-1 py-1 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${section}-${index}`}>
              <td className="border border-slate-400 px-1 py-0.5 text-center font-medium">
                {index + 1}
              </td>
              <SheetTextCell
                field={row.designation}
                readOnly={readOnly}
                onChange={(v) =>
                  onManualChange?.({ section, index, field: "designation" }, v)
                }
              />
              <SheetNumCell
                field={row.stockOuverture}
                readOnly={readOnly}
                onChange={(v) =>
                  onManualChange?.({ section, index, field: "stockOuverture" }, v)
                }
              />
              <SheetNumCell
                field={row.quantiteRecue}
                readOnly={readOnly}
                onChange={(v) =>
                  onManualChange?.({ section, index, field: "quantiteRecue" }, v)
                }
              />
              <SheetNumCell field={row.stockTotal} readOnly />
              <SheetNumCell
                field={row.btePu}
                readOnly={readOnly}
                money
                step="1"
                onChange={(v) => onManualChange?.({ section, index, field: "btePu" }, v)}
              />
              <SheetNumCell
                field={row.puNet}
                readOnly={readOnly}
                money
                step="1"
                onChange={(v) => onManualChange?.({ section, index, field: "puNet" }, v)}
              />
              <SheetNumCell
                field={row.venteJour}
                readOnly={readOnly}
                onChange={(v) =>
                  onManualChange?.({ section, index, field: "venteJour" }, v)
                }
              />
              <SheetNumCell field={row.stockFinJour} readOnly />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={8}
              className="border border-slate-400 px-2 py-1 text-right text-[10px] font-bold"
            >
              VENTE TOTALE {title.split(" ").slice(-1)[0]} :
            </td>
            <td className="border border-slate-400 bg-sky-50/80 px-1 py-0.5 text-right text-[10px] font-bold">
              {formatMoney(venteTotale)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function AmountTable({
  title,
  rows,
  total,
  section,
  onManualChange,
  readOnly,
}: {
  title: string;
  rows: ComputedAmountLine[];
  total: number;
  section: "creditsAnterieurs" | "creditsJour" | "expenses" | "defenses";
  onManualChange?: StationSessionSheetProps["onManualChange"];
  readOnly?: boolean;
}) {
  return (
    <div className="mb-2">
      <SectionTitle>{title}</SectionTitle>
      <table className="w-full border-collapse text-[10px]">
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${section}-${index}`}>
              <SheetTextCell
                field={row.label}
                readOnly={readOnly}
                placeholder="Libellé"
                onChange={(v) =>
                  onManualChange?.({ section, index, field: "label" }, v)
                }
              />
              <SheetNumCell
                field={row.amount}
                readOnly={readOnly}
                money
                step="1"
                onChange={(v) =>
                  onManualChange?.({ section, index, field: "amount" }, v)
                }
              />
            </tr>
          ))}
          <tr>
            <td className="border border-slate-400 px-2 py-1 text-right font-bold">TOTAL :</td>
            <td className="border border-slate-400 bg-sky-50/80 px-1 py-0.5 text-right font-bold">
              {formatMoney(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function FuelRow({
  row,
  active,
  onManualChange,
  readOnly,
}: {
  row: ComputedFuelLine;
  active: boolean;
  onManualChange?: StationSessionSheetProps["onManualChange"];
  readOnly?: boolean;
}) {
  const id = row.id;
  return (
    <tr className={active ? "bg-emerald-50/50" : ""}>
      <td className="border border-slate-400 px-1 py-0.5 font-semibold">{row.label}</td>
      <SheetNumCell
        field={row.pu}
        readOnly={readOnly}
        money
        step="1"
        onChange={(v) => onManualChange?.({ section: "fuel", lineId: id, field: "pu" }, v)}
      />
      <SheetNumCell
        field={row.stockRenterieur}
        readOnly={readOnly}
        onChange={(v) =>
          onManualChange?.({ section: "fuel", lineId: id, field: "stockRenterieur" }, v)
        }
      />
      <SheetNumCell
        field={row.stockOuverture}
        readOnly={readOnly}
        onChange={(v) =>
          onManualChange?.({ section: "fuel", lineId: id, field: "stockOuverture" }, v)
        }
      />
      <SheetNumCell
        field={row.depotRempli}
        readOnly={readOnly}
        onChange={(v) =>
          onManualChange?.({ section: "fuel", lineId: id, field: "depotRempli" }, v)
        }
      />
      <SheetNumCell
        field={row.ventesJour}
        readOnly={readOnly}
        onChange={(v) =>
          onManualChange?.({ section: "fuel", lineId: id, field: "ventesJour" }, v)
        }
      />
      <SheetNumCell
        field={row.stockAjusteSortie}
        readOnly={readOnly}
        onChange={(v) =>
          onManualChange?.({ section: "fuel", lineId: id, field: "stockAjusteSortie" }, v)
        }
      />
      <SheetNumCell
        field={row.quantitePerdue}
        readOnly={readOnly}
        onChange={(v) =>
          onManualChange?.({ section: "fuel", lineId: id, field: "quantitePerdue" }, v)
        }
      />
      <SheetNumCell field={row.totalStock} readOnly />
      <SheetNumCell
        field={row.sortieStockSupplementaire}
        readOnly={readOnly}
        onChange={(v) =>
          onManualChange?.(
            { section: "fuel", lineId: id, field: "sortieStockSupplementaire" },
            v,
          )
        }
      />
      <SheetNumCell field={row.stockDispoFinJour} readOnly />
      <SheetNumCell field={row.ecartStockFinJour} readOnly />
    </tr>
  );
}

function SummaryTable({ rows }: { rows: ComputedSummaryRow[] }) {
  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr className="bg-slate-50">
          <th className="border border-slate-400 px-1 py-1 font-semibold">DESIGNATIONS</th>
          <th className="border border-slate-400 px-1 py-1 font-semibold">VENTE DU JOUR</th>
          <th className="border border-slate-400 px-1 py-1 font-semibold">
            REPORT DE LA VEILLE
          </th>
          <th className="border border-slate-400 px-1 py-1 font-semibold">
            TOTAL DU MOIS A CE JOUR
          </th>
          <th className="border border-slate-400 px-1 py-1 font-semibold">
            CHIFFRE D&apos;AFFAIRES CUMULES
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="border border-slate-400 px-1 py-0.5 font-semibold">{row.label}</td>
            <td className="border border-slate-400 bg-sky-50/80 px-1 py-0.5 text-right">
              {formatSummaryValue(row.venteJour.value, row.unit)}
            </td>
            <td className="border border-slate-400 bg-slate-100 px-1 py-0.5 text-right">
              {formatSummaryValue(row.reportVeille.value, row.unit)}
            </td>
            <td className="border border-slate-400 bg-sky-50/80 px-1 py-0.5 text-right">
              {formatSummaryValue(row.totalMois.value, row.unit)}
            </td>
            <td className="border border-slate-400 bg-sky-50/80 px-1 py-0.5 text-right">
              {formatSummaryValue(row.caCumules.value, row.unit)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CashControlRow({
  label,
  field,
  onChange,
  readOnly,
  highlight,
}: {
  label: string;
  field: CellField;
  onChange?: (value: number | string) => void;
  readOnly?: boolean;
  highlight?: boolean;
}) {
  const isText = typeof field.value === "string";
  const tone = highlight
    ? "bg-rose-50 font-bold text-rose-900"
    : cellTone(field.kind, field.editable);

  if (isText) {
    return (
      <tr>
        <td className="border border-slate-400 px-2 py-0.5 font-semibold">{label}</td>
        <SheetTextCell
          field={field as CellField & { value: string }}
          readOnly={readOnly}
          onChange={(v) => onChange?.(v)}
        />
      </tr>
    );
  }

  const numField = field as CellField & { value: number };
  const editable = numField.editable && !readOnly && onChange;

  return (
    <tr>
      <td className="border border-slate-400 px-2 py-0.5 font-semibold">{label}</td>
      {editable ? (
        <td className={`border border-slate-400 p-0 ${tone}`}>
          <input
            type="number"
            min={0}
            step="1"
            value={numField.value}
            onChange={(e) => onChange?.(Number(e.target.value) || 0)}
            className="h-7 w-full bg-transparent px-1 text-right text-[10px] outline-none focus:bg-emerald-50/60"
          />
        </td>
      ) : (
        <td className={`border border-slate-400 px-1 py-0.5 text-right text-[10px] ${tone}`}>
          {formatMoney(numField.value)}
        </td>
      )}
    </tr>
  );
}

export function StationSessionSheet({
  stationName,
  managerName,
  pompisteName,
  openedAt,
  computed,
  activeFuelLineId,
  onManualChange,
  readOnly = false,
}: StationSessionSheetProps) {
  const openedDate = new Date(openedAt);
  const cc = computed.cashControl;

  return (
    <section
      id="station-session-sheet"
      className="station-session-sheet overflow-x-auto rounded-xl border border-slate-300 bg-white p-3 print:overflow-visible print:rounded-none print:border-black print:p-2 print:shadow-none"
    >
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body * {
            visibility: hidden;
          }
          #station-session-sheet,
          #station-session-sheet * {
            visibility: visible;
          }
          #station-session-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="min-w-[1200px] text-[10px] leading-tight text-slate-900">
        <header className="mb-2 grid grid-cols-[1fr_2fr_1fr] gap-2 border border-slate-500">
          <div className="flex items-center justify-center border-r border-slate-400 p-2">
            <div className="text-center">
              <p className="text-[14px] font-black tracking-widest">{stationName}</p>
              <p className="mt-1 text-[9px] text-slate-600">Station-service</p>
            </div>
          </div>
          <div className="flex items-center justify-center border-r border-slate-400 p-2">
            <h2 className="text-center text-[15px] font-black uppercase tracking-tight">
              Etat journalier des ventes
            </h2>
          </div>
          <div className="space-y-1 p-2">
            <p>
              <span className="font-semibold">STATION (S) :</span> {stationName}
            </p>
            <p>
              <span className="font-semibold">NOM DU GERANT :</span>{" "}
              {managerName ?? "—"}
            </p>
            <p>
              <span className="font-semibold">SEJOUR / DATE :</span>{" "}
              {openedDate.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
              })}
            </p>
            <p>
              <span className="font-semibold">POMPISTE :</span> {pompisteName}
            </p>
          </div>
        </header>

        {/* Section 1 */}
        <SectionTitle>
          1 — MOUVEMENT DES CARBURANTS (STOCK INITIAL — STOCK GENERAL)
        </SectionTitle>
        <table className="mb-1 w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              {[
                "CARBURANT ET LUBRIFIANTS",
                "P.U",
                "(1) STOCK RENTRIEUR",
                "(2) STOCK OUVERTURE",
                "(3) DEPOT REMPLI CE JOUR",
                "(4) VENTES CE JOUR",
                "(5) STOCK AJUSTE SORTIE",
                "(6) QUANTITE PERDUE",
                "(7) TOTAL STOCK",
                "(8) SORTIE STOCK SUPPLEMENTAIRE",
                "(9) STOCK DISPONIBLE EN FIN JOUR",
                "(10) ECART SUR STOCK FIN JOUR",
              ].map((h) => (
                <th key={h} className="border border-slate-400 px-1 py-1 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {computed.fuelLines.map((row) => (
              <FuelRow
                key={row.id}
                row={row}
                active={row.id === activeFuelLineId}
                onManualChange={onManualChange}
                readOnly={readOnly}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={11}
                className="border border-slate-400 px-2 py-1 text-right font-bold uppercase"
              >
                RECEPTION TOTALE CARBURANT DEPUIS LE DEBUT DU MOIS :
              </td>
              <td className="border border-slate-400 bg-sky-50/80 px-1 py-0.5 text-right font-bold">
                {formatLiters(computed.receptionTotaleMoisLiters.value)} Litres
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Section 2 */}
        <SectionTitle>2 — MOUVEMENT LUBRIFIANTS GAZ &amp; DIVERSIFICATIONS</SectionTitle>
        <ShopTable
          title="CONTROLE STOCK LUBRIFIANTS"
          rows={computed.lubricants}
          venteTotale={computed.venteTotaleLubrifiants.value}
          section="lubricants"
          onManualChange={onManualChange}
          readOnly={readOnly}
        />
        <ShopTable
          title="CONTROLE STOCK GAZ"
          rows={computed.gas}
          venteTotale={computed.venteTotaleGaz.value}
          section="gas"
          onManualChange={onManualChange}
          readOnly={readOnly}
        />
        <ShopTable
          title="CONTROLE STOCK DIVERS"
          rows={computed.divers}
          venteTotale={computed.venteTotaleDivers.value}
          section="divers"
          onManualChange={onManualChange}
          readOnly={readOnly}
        />

        <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Section 3 */}
          <div>
            <SectionTitle>3 — RECAPITULATION DES VENTES DU JOUR</SectionTitle>
            <SummaryTable rows={computed.summaryRows} />
          </div>

          {/* Sections 4–8 */}
          <div>
            <AmountTable
              title="4 — CREDITS ANTERIEURS ENCAISSES"
              rows={computed.creditsAnterieurs}
              total={computed.totalCreditsAnterieurs.value}
              section="creditsAnterieurs"
              onManualChange={onManualChange}
              readOnly={readOnly}
            />
            <AmountTable
              title="CREDITS JOUR"
              rows={computed.creditsJour}
              total={computed.totalCreditsJour.value}
              section="creditsJour"
              onManualChange={onManualChange}
              readOnly={readOnly}
            />
            <AmountTable
              title="5 — DEPENSES DU JOUR"
              rows={computed.expenses}
              total={computed.totalDepenses.value}
              section="expenses"
              onManualChange={onManualChange}
              readOnly={readOnly}
            />
            <AmountTable
              title="6 — DEFENSES DU JOUR"
              rows={computed.defenses}
              total={computed.totalDefenses.value}
              section="defenses"
              onManualChange={onManualChange}
              readOnly={readOnly}
            />

            <SectionTitle>7 — MANQUANTS / SURPLUS</SectionTitle>
            <table className="mb-2 w-full border-collapse">
              <tbody>
                <CashControlRow
                  label="MANQUANTS"
                  field={computed.manquants}
                  readOnly={readOnly}
                  onChange={(v) =>
                    onManualChange?.({ section: "root", field: "manquantsSaisis" }, v)
                  }
                />
                <CashControlRow
                  label="SURPLUS"
                  field={computed.surplus}
                  readOnly={readOnly}
                  onChange={(v) =>
                    onManualChange?.({ section: "root", field: "surplusSaisis" }, v)
                  }
                />
                <tr>
                  <td className="border border-slate-400 px-2 py-0.5 font-bold">TOTAL :</td>
                  <td className="border border-slate-400 bg-sky-50/80 px-1 py-0.5 text-right font-bold">
                    {formatMoney(computed.totalManquantsSurplus.value)}
                  </td>
                </tr>
              </tbody>
            </table>

            <SectionTitle>8 — CONTROLE CAISSE</SectionTitle>
            <table className="w-full border-collapse">
              <tbody>
                <CashControlRow
                  label="RECETTE TOTALE"
                  field={cc.recetteTotale}
                  highlight
                  readOnly={readOnly}
                  onChange={(v) =>
                    onManualChange?.({ section: "root", field: "recetteTotale" }, v)
                  }
                />
                <CashControlRow
                  label="ENCAISSEMENT CREDITS ANTERIEURS"
                  field={cc.encaissementCreditsAnterieurs}
                  readOnly
                />
                <CashControlRow label="DEPENSES DU JOUR" field={cc.depensesJour} readOnly />
                <CashControlRow
                  label="CHIFFRE D'AFFAIRES DU JOUR"
                  field={cc.chiffreAffairesJour}
                  readOnly
                />
                <CashControlRow label="CREDITS DU JOUR" field={cc.creditsJour} readOnly />
                <CashControlRow
                  label="DEPENSES SOCIALES"
                  field={cc.depensesSociales}
                  readOnly={readOnly}
                  onChange={(v) =>
                    onManualChange?.({ section: "root", field: "depensesSociales" }, v)
                  }
                />
                <CashControlRow
                  label="OUAGA - BOUST1"
                  field={cc.ouagaBoust}
                  readOnly={readOnly}
                  onChange={(v) =>
                    onManualChange?.({ section: "root", field: "ouagaBoust" }, v)
                  }
                />
                <CashControlRow label="RECETTE NETTE" field={cc.recetteNette} readOnly />
                <CashControlRow
                  label="MANQUANTS / SURPLUS"
                  field={cc.manquantsSurplus}
                  readOnly
                />
                <CashControlRow
                  label="POURSUITES"
                  field={cc.poursuites}
                  readOnly={readOnly}
                  onChange={(v) =>
                    onManualChange?.({ section: "root", field: "poursuites" }, v)
                  }
                />
                <CashControlRow label="VERSEMENT NET A EFFECTUER" field={cc.versementNet} readOnly />
                <CashControlRow
                  label="TOTAL OBSERVATIONS"
                  field={cc.observations}
                  readOnly={readOnly}
                  onChange={(v) =>
                    onManualChange?.({ section: "root", field: "observations" }, v)
                  }
                />
              </tbody>
            </table>
          </div>
        </div>

        <footer className="mt-3 grid grid-cols-2 gap-4 border-t border-slate-400 pt-3 text-[10px]">
          <p>
            Nom, Prénoms et Signature de l&apos;agent de remplissage :{" "}
            <span className="font-semibold">{pompisteName}</span>
          </p>
          <p className="text-right">Date et signature du Gérant</p>
        </footer>
        <p className="mt-2 text-center text-[9px] italic text-slate-600">
          A tenir au jour le jour et a le conserver sur la station service pour différentes
          contrôles.
        </p>
      </div>
    </section>
  );
}
