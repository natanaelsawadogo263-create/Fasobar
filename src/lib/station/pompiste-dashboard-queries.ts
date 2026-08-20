import "server-only";

import { cache } from "react";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import {
  computeStationSheet,
  parseSheetCarryForward,
  parseSheetManual,
  resolveFuelLineId,
  type FuelLineId,
  type StationSheetPrices,
} from "@/lib/station/sheet-engine";
import type {
  OwnOpenPumpSession,
  OtherOpenPumpSession,
  PumpForSelect,
} from "@/lib/station/pump-session-types";
import {
  getOpenPumpSessionsHeldByOthers,
  getOwnOpenPumpSession,
  listActivePumpsForPumpSelection,
} from "@/lib/station/pump-session-queries";

export type PompistePumpCard = PumpForSelect & {
  status: "mine" | "occupied" | "available";
  openedByName: string | null;
  openedAt: string | null;
};

export type PompisteLiveStats = {
  indexStart: number;
  indexCurrent: number;
  litersSold: number;
  estimatedRevenue: number;
  openedAt: string;
  durationMinutes: number;
};

export type PompisteDashboardData = {
  establishmentName: string;
  operatorName: string;
  ownSession: OwnOpenPumpSession | null;
  pumps: PompistePumpCard[];
  liveStats: PompisteLiveStats | null;
  teamOnShift: OtherOpenPumpSession[];
  availablePumpCount: number;
};

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

function computeLiveStats(
  session: OwnOpenPumpSession,
  pumps: PumpForSelect[],
): PompisteLiveStats {
  const prices = resolvePrices(pumps, session.pricePerLiter);
  const activeFuelLineId = (session.activeFuelLineId ??
    resolveFuelLineId(session.fuelTypeName, session.fuelPumpName)) as FuelLineId;
  const manual = parseSheetManual(session.sheetManual, prices);
  const line = manual.fuelLines[activeFuelLineId];
  if (line) {
    line.stockRenterieur = session.indexStart;
    line.stockOuverture = session.indexStart;
    if (!line.stockAjusteSortie || line.stockAjusteSortie < session.indexStart) {
      line.stockAjusteSortie = session.indexStart;
    }
    line.pu = session.pricePerLiter;
  }

  const indexCurrent = line?.stockAjusteSortie ?? session.indexStart;
  const computed = computeStationSheet({
    isInitialSession: session.isInitialSession,
    activeFuelLineId,
    sessionIndexStart: session.indexStart,
    sessionIndexEnd: indexCurrent,
    carryForward: parseSheetCarryForward(session.sheetCarryForward ?? undefined),
    prices,
    manual,
  });

  const activeLine = computed.fuelLines.find((row) => row.id === activeFuelLineId);
  const litersSold = activeLine?.ventesJour.value ?? 0;
  const estimatedRevenue = Math.round(litersSold * session.pricePerLiter);
  const openedMs = Date.now() - new Date(session.openedAt).getTime();

  return {
    indexStart: session.indexStart,
    indexCurrent,
    litersSold,
    estimatedRevenue,
    openedAt: session.openedAt,
    durationMinutes: Math.max(0, Math.floor(openedMs / 60_000)),
  };
}

function buildPumpCards(
  pumps: PumpForSelect[],
  ownSession: OwnOpenPumpSession | null,
  teamSessions: OtherOpenPumpSession[],
): PompistePumpCard[] {
  const occupiedByLine = new Map(
    teamSessions.map((session) => [session.fuelLineId, session]),
  );

  return pumps.map((pump) => {
    const sessionLineId = ownSession
      ? (ownSession.activeFuelLineId ??
        resolveFuelLineId(ownSession.fuelTypeName, ownSession.fuelPumpName))
      : null;

    if (ownSession && sessionLineId === pump.fuelLineId) {
      return {
        ...pump,
        status: "mine",
        openedByName: ownSession.openedByName,
        openedAt: ownSession.openedAt,
      };
    }

    const occupied = occupiedByLine.get(pump.fuelLineId);
    if (occupied) {
      return {
        ...pump,
        status: "occupied",
        openedByName: occupied.openedByName,
        openedAt: occupied.openedAt,
      };
    }

    return {
      ...pump,
      status: "available",
      openedByName: null,
      openedAt: null,
    };
  });
}

export const getPompisteDashboardData = cache(async function getPompisteDashboardData(
  workspace: WorkspaceContext,
): Promise<PompisteDashboardData> {
  const [ownSession, pumps, teamOnShift] = await Promise.all([
    getOwnOpenPumpSession(workspace),
    listActivePumpsForPumpSelection(workspace),
    getOpenPumpSessionsHeldByOthers(workspace),
  ]);

  const pumpCards = buildPumpCards(pumps, ownSession, teamOnShift);
  const availablePumpCount = pumpCards.filter((p) => p.status === "available").length;

  return {
    establishmentName: workspace.establishmentName,
    operatorName: workspace.ownerName,
    ownSession,
    pumps: pumpCards,
    liveStats: ownSession ? computeLiveStats(ownSession, pumps) : null,
    teamOnShift,
    availablePumpCount,
  };
});
