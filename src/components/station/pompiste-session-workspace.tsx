/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { InstantLink, startNavProgress } from "@/components/layout/instant-link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Lock, Printer, Receipt, Truck } from "lucide-react";

import {
  closePumpSessionAction,
  openPumpSessionAction,
  savePumpSessionSheetAction,
} from "@/app/(protected)/application/station/pompiste/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { StationSessionSheet } from "@/components/station/station-session-sheet";
import { FormSection, NumberField, TextField } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { formatPriceXof } from "@/lib/products/constants";
import {
  applySheetManualChange,
  computeStationSheet,
  createEmptyManual,
  parseSheetCarryForward,
  parseSheetManual,
  resolveFuelLineId,
  type FuelLineId,
  type SheetManualPath,
  type StationSheetManual,
  type StationSheetPrices,
} from "@/lib/station/sheet-engine";
import type {
  OwnOpenPumpSession,
  OtherOpenPumpSession,
  PumpForSelect,
  StationSheetBootstrap,
} from "@/lib/station/pump-session-types";

function resolvePrices(pumps: PumpForSelect[], fallbackPrice: number): StationSheetPrices {
  const upper = (name: string) => name.toUpperCase();
  const superPump = pumps.find(
    (p) => upper(p.fuelTypeName).includes("SUPER") || upper(p.fuelTypeName).includes("SS"),
  );
  const gazPump = pumps.find(
    (p) =>
      upper(p.fuelTypeName).includes("GO") ||
      upper(p.fuelTypeName).includes("GAZOIL") ||
      upper(p.fuelTypeName).includes("GASOIL") ||
      upper(p.fuelTypeName).includes("DIESEL"),
  );
  return {
    superPu: superPump?.pricePerLiter ?? fallbackPrice,
    gazoilPu: gazPump?.pricePerLiter ?? fallbackPrice,
  };
}

function sumCreditsJour(manual: StationSheetManual): number {
  return manual.creditsJour.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

function firstCreditCustomer(manual: StationSheetManual): string {
  const line = manual.creditsJour.find((row) => row.amount > 0 && row.label.trim());
  return line?.label.trim() ?? "";
}

type PompisteSessionWorkspaceProps = {
  ownSession: OwnOpenPumpSession | null;
  pumps: PumpForSelect[];
  otherOpenSessionsByPump: Record<string, OtherOpenPumpSession>;
  lastClosedIndexEndByPump: Record<string, number | null>;
  sheetBootstrap: StationSheetBootstrap;
  stationName?: string;
  stationLogoUrl?: string | null;
  operatorName?: string;
};

export function PompisteSessionWorkspace({
  ownSession,
  pumps,
  otherOpenSessionsByPump,
  lastClosedIndexEndByPump,
  sheetBootstrap,
  stationName = "Station",
  stationLogoUrl: _stationLogoUrl = null,
  operatorName = "Pompiste",
}: PompisteSessionWorkspaceProps) {
  const router = useRouter();
  const { show } = useToast();

  const [optimisticSession, setOptimisticSession] = useState<OwnOpenPumpSession | null>(
    null,
  );
  const effectiveSession = ownSession ?? optimisticSession;

  useEffect(() => {
    if (ownSession?.id) {
      setOptimisticSession(null);
    }
  }, [ownSession?.id]);

  const [formError, setFormError] = useState<string | null>(null);
  const [isClosePending, startCloseTransition] = useTransition();
  const [creditCustomerPhone, setCreditCustomerPhone] = useState("");

  const prices = useMemo(
    () => resolvePrices(pumps, effectiveSession?.pricePerLiter ?? 0),
    [pumps, effectiveSession?.pricePerLiter],
  );

  const activeFuelLineId = useMemo((): FuelLineId => {
    if (effectiveSession?.activeFuelLineId) {
      return effectiveSession.activeFuelLineId as FuelLineId;
    }
    if (!effectiveSession) return "SUPER_1";
    return resolveFuelLineId(effectiveSession.fuelTypeName, effectiveSession.fuelPumpName);
  }, [effectiveSession]);

  const carryForward = useMemo(
    () =>
      parseSheetCarryForward(
        effectiveSession?.sheetCarryForward ?? sheetBootstrap.carryForward ?? undefined,
      ),
    [effectiveSession?.sheetCarryForward, sheetBootstrap.carryForward],
  );

  const isInitialSession =
    effectiveSession?.isInitialSession ?? sheetBootstrap.isInitialSession;

  const [manual, setManual] = useState<StationSheetManual>(() =>
    createEmptyManual(prices),
  );

  useEffect(() => {
    if (!effectiveSession) return;
    const parsed = parseSheetManual(effectiveSession.sheetManual, prices);
    const line = parsed.fuelLines[activeFuelLineId];
    if (line) {
      line.stockRenterieur = effectiveSession.indexStart;
      line.stockOuverture = effectiveSession.indexStart;
      if (!line.stockAjusteSortie || line.stockAjusteSortie < effectiveSession.indexStart) {
        line.stockAjusteSortie = effectiveSession.indexStart;
      }
      line.pu = effectiveSession.pricePerLiter;
    }
    setManual(parsed);
    setCreditCustomerPhone("");
    setFormError(null);
  }, [effectiveSession?.id, activeFuelLineId, effectiveSession, prices]);

  const sessionIndexEnd = manual.fuelLines[activeFuelLineId]?.stockAjusteSortie ?? 0;

  const computed = useMemo(
    () =>
      effectiveSession
        ? computeStationSheet({
            isInitialSession,
            activeFuelLineId,
            sessionIndexStart: effectiveSession.indexStart,
            sessionIndexEnd,
            carryForward,
            prices,
            manual,
          })
        : null,
    [
      effectiveSession,
      isInitialSession,
      activeFuelLineId,
      sessionIndexEnd,
      carryForward,
      prices,
      manual,
    ],
  );

  const indexEndError = useMemo(() => {
    if (!effectiveSession) return null;
    if (sessionIndexEnd < effectiveSession.indexStart) {
      return "L'index de fin doit être supérieur ou égal à l'index de début.";
    }
    return null;
  }, [effectiveSession, sessionIndexEnd]);

  const creditAmountInt = sumCreditsJour(manual);
  const cashDifference = computed?.cashControl.manquantsSurplus.value ?? 0;

  const handleManualChange = useCallback((path: SheetManualPath, value: number | string) => {
    setManual((prev) => applySheetManualChange(prev, path, value));
  }, []);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!effectiveSession || optimisticSession) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void savePumpSessionSheetAction({
        sessionId: effectiveSession.id,
        sheetManual: manual,
      });
    }, 700);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [manual, effectiveSession, optimisticSession]);

  // -------------------------
  // Open form state
  // -------------------------
  const blockedPumpIds = useMemo(
    () => new Set(Object.keys(otherOpenSessionsByPump)),
    [otherOpenSessionsByPump],
  );

  const [selectedPumpId, setSelectedPumpId] = useState<string>("");
  const [indexStart, setIndexStart] = useState<string>("0");
  const [indexGapReason, setIndexGapReason] = useState<string>("");
  const [isOpenPending, startOpenTransition] = useTransition();
  const selectedPump = useMemo(
    () => pumps.find((p) => p.id === selectedPumpId) ?? null,
    [pumps, selectedPumpId],
  );

  useEffect(() => {
    if (effectiveSession) return;
    if (pumps.length === 0) {
      setSelectedPumpId("");
      return;
    }
    const next =
      pumps.find((p) => !blockedPumpIds.has(p.id))?.id ?? pumps[0]?.id ?? "";
    setSelectedPumpId(next);
  }, [effectiveSession, pumps, blockedPumpIds]);

  const prefillIndexEnd = useMemo(() => {
    if (!selectedPumpId) return 0;
    return lastClosedIndexEndByPump[selectedPumpId] ?? 0;
  }, [lastClosedIndexEndByPump, selectedPumpId]);

  useEffect(() => {
    if (effectiveSession) return;
    if (!selectedPumpId) return;
    setFormError(null);
    setIndexStart(String(prefillIndexEnd ?? 0));
    setIndexGapReason("");
  }, [effectiveSession, selectedPumpId, prefillIndexEnd]);

  const mismatch = useMemo(() => {
    return (
      Math.round((Number(indexStart) || 0) * 1000) !==
      Math.round(prefillIndexEnd * 1000)
    );
  }, [indexStart, prefillIndexEnd]);

  const isSelectedBlocked = selectedPumpId
    ? blockedPumpIds.has(selectedPumpId)
    : false;

  const hasAnyAvailablePump = pumps.some((p) => !blockedPumpIds.has(p.id));

  useEffect(() => setFormError(null), [effectiveSession?.id]);

  if (effectiveSession && computed) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-3 py-3 print:overflow-visible sm:px-4 sm:py-4">
        <header className="no-print shrink-0 space-y-3">
          <InstantLink
            href="/application/station/pompiste"
            className="inline-flex min-h-10 items-center gap-1 text-[12px] font-semibold text-emerald-700 active:text-emerald-800"
          >
            ← Retour à Ma pompe
          </InstantLink>
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 ring-1 ring-emerald-100">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Fiche journalière
                </p>
                <h1 className="mt-1 text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
                  {effectiveSession.fuelPumpName}
                </h1>
                <p className="mt-1 text-[12px] text-slate-600">
                  {effectiveSession.fuelTypeName} · {effectiveSession.fuelTankName} ·{" "}
                  {new Date(effectiveSession.openedAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-[11px] font-bold uppercase tracking-wide text-white">
                Relève active
              </span>
            </div>
            <p className="mt-3 text-[12px] font-medium text-emerald-800">
              Saisissez la fiche — FasoBar calcule ventes, stocks et écarts automatiquement.
            </p>
          </div>
        </header>

        <form
          className="shrink-0 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (indexEndError) return;
            if (creditAmountInt > 0 && !firstCreditCustomer(manual)) {
              setFormError("Indiquez le nom du client pour le crédit du jour.");
              return;
            }

            const formData = new FormData(event.currentTarget);
            setFormError(null);
            startNavProgress();

            startCloseTransition(async () => {
              const result = await closePumpSessionAction({}, formData);
              if (result?.error) {
                setFormError(result.error);
                return;
              }
              show(result?.success ?? "Session clôturée.");
              setOptimisticSession(null);
              router.refresh();
            });
          }}
        >
          <input type="hidden" name="sessionId" value={effectiveSession.id} />
          <input type="hidden" name="indexEnd" value={String(sessionIndexEnd)} />
          <input type="hidden" name="cashAmount" value={String(manual.recetteTotale)} />
          <input type="hidden" name="orangeMoneyAmount" value="0" />
          <input type="hidden" name="moovMoneyAmount" value="0" />
          <input type="hidden" name="telecelMoneyAmount" value="0" />
          <input type="hidden" name="cardAmount" value="0" />
          <input type="hidden" name="otherAmount" value="0" />
          <input type="hidden" name="creditAmount" value={String(creditAmountInt)} />
          <input type="hidden" name="creditCustomerName" value={firstCreditCustomer(manual)} />
          <input type="hidden" name="creditCustomerPhone" value={creditCustomerPhone} />
          <input type="hidden" name="sheetManual" value={JSON.stringify(manual)} />

          {formError ? (
            <div className="no-print">
              <AlertMessage message={formError} />
            </div>
          ) : null}

          {indexEndError ? (
            <div className="no-print rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
              {indexEndError}
            </div>
          ) : null}

          <StationSessionSheet
            stationName={stationName}
            pompisteName={effectiveSession.openedByName ?? operatorName}
            openedAt={effectiveSession.openedAt}
            computed={computed}
            activeFuelLineId={activeFuelLineId}
            onManualChange={handleManualChange}
          />

          {creditAmountInt > 0 ? (
            <div className="no-print rounded-xl border border-amber-200 bg-amber-50 p-3">
              <TextField
                id="creditCustomerPhone"
                name="creditCustomerPhoneVisible"
                label="Téléphone client crédit (optionnel)"
                placeholder="Ex : 07 00 00 00 00"
                value={creditCustomerPhone}
                onChange={(event) => setCreditCustomerPhone(event.target.value)}
              />
              <p className="mt-2 text-[11px] text-amber-900">
                Nom client crédit : saisissez-le dans la section « CREDITS JOUR » de la fiche.
              </p>
            </div>
          ) : null}

          <div className="no-print rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-700">
            <p>
              <span className="font-semibold">Écart caisse carburant :</span>{" "}
              {cashDifference === 0
                ? "0"
                : `${cashDifference > 0 ? "+" : "-"}${formatPriceXof(Math.abs(cashDifference))}`}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Ligne active : {activeFuelLineId.replace("_", " ")} · index début{" "}
              {effectiveSession.indexStart.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
            </p>
          </div>

          <footer className="no-print shrink-0 space-y-2 border-t border-slate-200 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Imprimer la fiche (A4)
            </button>
            <button
              type="submit"
              disabled={isClosePending || indexEndError != null}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              {isClosePending ? "Clôture en cours…" : "Fermer ma session"}
            </button>
            <InstantLink
              href="/application/station/pompiste"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700 active:bg-slate-50"
            >
              Retour
            </InstantLink>
          </footer>
        </form>
      </div>
    );
  }

  // -------------------------
  // Open mode
  // -------------------------
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
      <header className="shrink-0 space-y-3">
        <InstantLink
          href="/application/station/pompiste"
          className="inline-flex min-h-10 items-center gap-1 text-[12px] font-semibold text-emerald-700 active:text-emerald-800"
        >
          ← Retour à Ma pompe
        </InstantLink>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Étape 1 · Ouverture
          </p>
          <h1 className="mt-1 text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
            Ouvrir ma relève
          </h1>
          <p className="mt-1 text-[12px] text-slate-600">
            Sélectionnez une pompe libre, confirmez l&apos;index de départ, puis lancez la fiche.
          </p>
        </div>
      </header>

      {pumps.length === 0 ? (
        <div className="flex h-full min-h-0 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
          <div>
            <p className="text-[13px] font-medium text-slate-800">Aucune pompe active</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Configurez d&apos;abord vos pompes dans l&apos;espace Station.
            </p>
          </div>
        </div>
      ) : (
        <form
          className="shrink-0 space-y-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 lg:p-5"
          onSubmit={(event) => {
            event.preventDefault();

            if (!selectedPumpId) {
              setFormError("Choisissez une pompe.");
              return;
            }

            if (isSelectedBlocked) {
              setFormError(
                "Cette pompe est déjà en cours de relève par un autre pompiste.",
              );
              return;
            }

            if (mismatch && indexGapReason.trim().length < 3) {
              setFormError("Indiquez un motif pour l'écart d'index.");
              return;
            }

            const formData = new FormData(event.currentTarget);
            setFormError(null);
            startNavProgress();

            startOpenTransition(async () => {
              const result = await openPumpSessionAction({}, formData);
              if (result?.error) {
                setFormError(result.error);
                return;
              }
              if (result.openedSession) {
                setOptimisticSession(result.openedSession);
              } else if (result.sessionId && selectedPump) {
                setOptimisticSession({
                  id: result.sessionId,
                  openedAt: new Date().toISOString(),
                  openedByName: operatorName,
                  fuelPumpId: selectedPump.id,
                  fuelPumpName: selectedPump.name,
                  fuelTypeName: selectedPump.fuelTypeName,
                  fuelTankName: selectedPump.fuelTankName,
                  pricePerLiter: selectedPump.pricePerLiter,
                  indexStart: Number(indexStart) || 0,
                  isInitialSession: sheetBootstrap.isInitialSession,
                  activeFuelLineId: resolveFuelLineId(
                    selectedPump.fuelTypeName,
                    selectedPump.name,
                  ),
                  sheetManual: null,
                  sheetCarryForward: sheetBootstrap.carryForward,
                });
              }
              show(result.success ?? "Session ouverte.");
              router.refresh();
            });
          }}
        >
          {formError ? <AlertMessage message={formError} /> : null}

          {!hasAnyAvailablePump ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-[12px] text-amber-950">
              <p className="font-semibold">Relève en attente</p>
              <p className="mt-1">
                Toutes les pompes sont déjà ouvertes par d&apos;autres pompistes.
              </p>
            </div>
          ) : null}

          <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pompe
                </p>
                <p className="mt-1 text-[14px] font-bold text-slate-900">
                  {selectedPump?.name ?? "—"}
                </p>
                <p className="mt-0.5 text-[12px] text-slate-600">
                  {selectedPump
                    ? `${selectedPump.fuelTypeName} · ${selectedPump.fuelTankName}`
                    : "—"}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-800 ring-1 ring-emerald-200/70">
                <Truck className="h-4 w-4" />
                {selectedPump ? `${formatPriceXof(selectedPump.pricePerLiter)} / L` : "—"}
              </span>
            </div>
          </div>

          <FormSection
            title="1) Pompe"
            description="Sélectionnez une pompe libre. FasoBar pré-remplit l'index précédent."
          >
            <div>
              <label
                htmlFor="fuelPumpId"
                className="mb-1 block text-[12px] font-medium text-slate-700"
              >
                Pompe
              </label>
              <select
                id="fuelPumpId"
                name="fuelPumpId"
                value={selectedPumpId}
                onChange={(e) => setSelectedPumpId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 sm:h-11"
                required
              >
                {pumps.map((pump) => {
                  const held = otherOpenSessionsByPump[pump.id];
                  const blocked = Boolean(held);
                  return (
                    <option key={pump.id} value={pump.id} disabled={blocked}>
                      {pump.name}
                      {blocked
                        ? ` (en cours${
                            held?.openedByName ? ` par ${held.openedByName}` : ""
                          })`
                        : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </FormSection>

          <input
            type="hidden"
            name="prefillIndexEnd"
            value={String(prefillIndexEnd)}
          />

          <FormSection title="2) Index de départ">
            <NumberField
              id="indexStart"
              name="indexStart"
              label="Index de départ (stock rentrieur)"
              min={0}
              step="0.001"
              required
              value={indexStart}
              onChange={(e) => setIndexStart(e.target.value)}
              hint={`Pré-rempli : ${prefillIndexEnd.toLocaleString("fr-FR", {
                maximumFractionDigits: 3,
              })}`}
            />
          </FormSection>

          {mismatch ? (
            <FormSection
              title="Motif de l'écart d'index"
              description="Obligatoire si votre index diffère du dernier index connu."
            >
              <TextField
                id="indexGapReason"
                name="indexGapReason"
                label="Motif"
                placeholder="Ex. changement de tuyauterie, différence de lecture..."
                required
                value={indexGapReason}
                onChange={(e) => setIndexGapReason(e.target.value)}
              />
            </FormSection>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-600">
              <p className="font-semibold text-slate-800">Index conforme</p>
              <p className="mt-1">Aucun motif requis.</p>
            </div>
          )}

          <footer className="shrink-0 space-y-2 border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={isOpenPending || isSelectedBlocked}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              <Receipt className="h-4 w-4" />
              {isOpenPending ? "Ouverture…" : "Ouvrir ma session"}
            </button>
            <InstantLink
              href="/application/station/pompiste"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700 active:bg-slate-50"
            >
              Annuler
            </InstantLink>
          </footer>
        </form>
      )}
    </div>
  );
}
