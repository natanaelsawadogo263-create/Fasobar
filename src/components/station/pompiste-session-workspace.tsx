/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { startNavProgress } from "@/components/layout/instant-link";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Lock, Printer, Receipt } from "lucide-react";

import {
  closePumpSessionAction,
  openPumpSessionAction,
  savePumpSessionSheetAction,
} from "@/app/(protected)/application/station/pompiste/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { StationSessionSheet } from "@/components/station/station-session-sheet";
import { TextField } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { formatPriceXof } from "@/lib/products/constants";
import {
  applySheetManualChange,
  computeStationSheet,
  createEmptyManual,
  DEFAULT_SHEET_PRICES,
  parseSheetCarryForward,
  parseSheetManual,
  type SheetManualPath,
  type StationSheetManual,
  type StationSheetPrices,
} from "@/lib/station/sheet-engine";
import type { OwnOpenPumpSession, StationSheetBootstrap } from "@/lib/station/pump-session-types";

function sumCreditsJour(manual: StationSheetManual): number {
  return manual.creditsJour.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

function firstCreditCustomer(manual: StationSheetManual): string {
  const line = manual.creditsJour.find((row) => row.amount > 0 && row.label.trim());
  return line?.label.trim() ?? "";
}

type PompisteSessionWorkspaceProps = {
  ownSession: OwnOpenPumpSession | null;
  sheetBootstrap: StationSheetBootstrap;
  prices: StationSheetPrices;
  stationName?: string;
  operatorName?: string;
};

export function PompisteSessionWorkspace({
  ownSession,
  sheetBootstrap,
  prices,
  stationName = "Station",
  operatorName = "Pompiste",
}: PompisteSessionWorkspaceProps) {
  const router = useRouter();
  const { show } = useToast();

  const [optimisticSession, setOptimisticSession] = useState<OwnOpenPumpSession | null>(null);
  const effectiveSession = ownSession ?? optimisticSession;

  useEffect(() => {
    if (ownSession?.id) setOptimisticSession(null);
  }, [ownSession?.id]);

  const [formError, setFormError] = useState<string | null>(null);
  const [isClosePending, startCloseTransition] = useTransition();
  const [isOpenPending, startOpenTransition] = useTransition();
  const [creditCustomerPhone, setCreditCustomerPhone] = useState("");

  const carryForward = useMemo(
    () =>
      parseSheetCarryForward(
        effectiveSession?.sheetCarryForward ?? sheetBootstrap.carryForward ?? undefined,
      ),
    [effectiveSession?.sheetCarryForward, sheetBootstrap.carryForward],
  );

  const isInitialSession =
    effectiveSession?.isInitialSession ?? sheetBootstrap.isInitialSession;

  const [manual, setManual] = useState<StationSheetManual>(() => createEmptyManual(prices));

  useEffect(() => {
    if (!effectiveSession) return;
    setManual(parseSheetManual(effectiveSession.sheetManual, prices));
    setCreditCustomerPhone("");
    setFormError(null);
  }, [effectiveSession?.id, effectiveSession, prices]);

  const computed = useMemo(
    () =>
      effectiveSession
        ? computeStationSheet({
            isInitialSession,
            activeFuelLineId: null,
            carryForward,
            prices,
            manual,
          })
        : null,
    [effectiveSession, isInitialSession, carryForward, prices, manual],
  );

  const creditAmountInt = sumCreditsJour(manual);

  const handleManualChange = useCallback((path: SheetManualPath, value: number | string) => {
    setManual((prev) => applySheetManualChange(prev, path, value));
  }, []);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!effectiveSession?.id || optimisticSession) return;
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
  }, [manual, effectiveSession?.id, optimisticSession]);

  if (effectiveSession) {
    const sheetComputed =
      computed ??
      computeStationSheet({
        isInitialSession,
        activeFuelLineId: null,
        carryForward,
        prices,
        manual,
      });
    const cashDifference = sheetComputed.cashControl.manquantsSurplus.value ?? 0;

    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-3 py-3 print:overflow-visible sm:px-4 sm:py-4">
        <header className="no-print shrink-0">
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 ring-1 ring-emerald-100">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Fiche journalière
                </p>
                <h1 className="mt-1 text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
                  État journalier des ventes
                </h1>
                <p className="mt-1 text-[12px] text-slate-600">
                  {operatorName} ·{" "}
                  {new Date(effectiveSession.openedAt).toLocaleString("fr-FR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-[11px] font-bold uppercase tracking-wide text-white">
                Session active
              </span>
            </div>
            <p className="mt-3 text-[12px] font-medium text-emerald-800">
              Remplissez la fiche — FasoBar calcule ventes, stocks et écarts automatiquement.
            </p>
          </div>
        </header>

        <form
          className="shrink-0 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
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
              refreshSoon(() => router.refresh());
            });
          }}
        >
          <input type="hidden" name="sessionId" value={effectiveSession.id} />
          <input type="hidden" name="indexEnd" value="0" />
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

          <StationSessionSheet
            stationName={stationName}
            pompisteName={effectiveSession.openedByName ?? operatorName}
            openedAt={effectiveSession.openedAt}
            computed={sheetComputed}
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
              disabled={isClosePending}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              {isClosePending ? "Clôture en cours…" : "Fermer ma session"}
            </button>
          </footer>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Station-service
          </p>
          <h1 className="mt-2 text-[22px] font-bold tracking-tight text-slate-900">
            Ma session
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
            Ouvrez votre session pour afficher la fiche journalière complète. Remplissez, imprimez,
            puis fermez quand vous avez terminé.
          </p>
        </div>

        {formError ? <AlertMessage message={formError} /> : null}

        <button
          type="button"
          disabled={isOpenPending}
          onClick={() => {
            setFormError(null);
            startNavProgress();
            startOpenTransition(async () => {
              try {
                const result = await openPumpSessionAction({}, new FormData());
                if (result?.error) {
                  setFormError(result.error);
                  return;
                }
                if (result.openedSession) {
                  setOptimisticSession(result.openedSession);
                } else if (result.sessionId) {
                  setOptimisticSession({
                    id: result.sessionId,
                    openedAt: new Date().toISOString(),
                    openedByName: operatorName,
                    fuelPumpId: "",
                    fuelPumpName: "Fiche journalière",
                    fuelTypeName: "—",
                    fuelTankName: "—",
                    pricePerLiter: DEFAULT_SHEET_PRICES.superPu,
                    indexStart: 0,
                    isInitialSession: sheetBootstrap.isInitialSession,
                    activeFuelLineId: null,
                    sheetManual: null,
                    sheetCarryForward: sheetBootstrap.carryForward,
                  });
                }
                show(result.success ?? "Session ouverte.");
              } catch {
                setFormError(
                  "Connexion interrompue. Vérifiez le réseau ou relancez l'application.",
                );
              }
            });
          }}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[15px] font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
        >
          <Receipt className="h-5 w-5" />
          {isOpenPending ? "Ouverture…" : "Ouvrir ma session"}
        </button>
      </div>
    </div>
  );
}
