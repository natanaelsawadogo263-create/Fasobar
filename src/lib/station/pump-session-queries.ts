import "server-only";

import { cache } from "react";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type {
  OwnOpenPumpSession,
  OtherOpenPumpSession,
  StationSheetBootstrap,
} from "@/lib/station/pump-session-types";
import type { StationSheetPrices } from "@/lib/station/sheet-engine";
import { DEFAULT_SHEET_PRICES } from "@/lib/station/sheet-engine";
import { listFuelLinesForSessionOpen } from "@/lib/station/fuel-line-selection";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function scopedPumpSessions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspace: WorkspaceContext,
  select: string,
) {
  return supabase
    .from("pump_sessions")
    .select(select)
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId);
}

export const listActivePumpsForPumpSelection = listFuelLinesForSessionOpen;

export const countInactiveFuelPumps = cache(async function countInactiveFuelPumps(
  _workspace: WorkspaceContext,
): Promise<number> {
  return 0;
});

const SESSION_ROW_SELECT_FULL =
  "id, opened_at, opened_by, index_start, price_per_liter, fuel_pump_id, fuel_type_id, fuel_tank_id, is_initial_session, active_fuel_line_id, sheet_manual, sheet_carry_forward";

const SESSION_ROW_SELECT_BASE =
  "id, opened_at, opened_by, index_start, price_per_liter, fuel_pump_id, fuel_type_id, fuel_tank_id";

type PumpSessionRow = {
  id: string;
  opened_at: string;
  opened_by: string;
  index_start: number | string;
  price_per_liter: number | string;
  fuel_pump_id: string | null;
  fuel_type_id: string | null;
  fuel_tank_id: string | null;
  is_initial_session?: boolean | null;
  active_fuel_line_id?: string | null;
  sheet_manual?: unknown;
  sheet_carry_forward?: unknown;
  fuel_pumps?: { name: string } | { name: string }[] | null;
  fuel_types?:
    | { name: string; selling_price?: number | string }
    | { name: string; selling_price?: number | string }[]
    | null;
  fuel_tanks?: { name: string } | { name: string }[] | null;
  profiles?: { full_name: string } | { full_name: string }[] | null;
};

async function hydrateOwnOpenSessionForSheet(
  row: PumpSessionRow,
  workspace: WorkspaceContext,
): Promise<OwnOpenPumpSession> {
  return {
    id: String(row.id),
    openedAt: String(row.opened_at),
    openedByName: workspace.ownerName,
    fuelPumpId: row.fuel_pump_id ? String(row.fuel_pump_id) : "",
    fuelPumpName: "Fiche journalière",
    fuelTypeName: "—",
    fuelTankName: "—",
    pricePerLiter: Number(row.price_per_liter ?? 0),
    indexStart: Number(row.index_start),
    isInitialSession: Boolean(row.is_initial_session),
    activeFuelLineId: row.active_fuel_line_id ? String(row.active_fuel_line_id) : null,
    sheetManual:
      row.sheet_manual && typeof row.sheet_manual === "object"
        ? (row.sheet_manual as Record<string, unknown>)
        : null,
    sheetCarryForward:
      row.sheet_carry_forward && typeof row.sheet_carry_forward === "object"
        ? (row.sheet_carry_forward as Record<string, unknown>)
        : null,
  };
}

/** @deprecated Préférer hydrateOwnOpenSessionForSheet — évite 4 requêtes labels inutiles. */
async function hydrateOwnOpenSessionSplit(
  row: PumpSessionRow,
  workspace: WorkspaceContext,
): Promise<OwnOpenPumpSession> {
  const supabase = await createClient();

  const orgId = workspace.organizationId;
  const estId = workspace.establishmentId;

  const [pumpRes, fuelTypeRes, fuelTankRes, profileRes] = await Promise.all([
    supabase
      .from("fuel_pumps")
      .select("name")
      .eq("id", row.fuel_pump_id)
      .eq("organization_id", orgId)
      .eq("establishment_id", estId)
      .maybeSingle(),
    supabase
      .from("fuel_types")
      .select("name, selling_price")
      .eq("id", row.fuel_type_id)
      .eq("organization_id", orgId)
      .eq("establishment_id", estId)
      .maybeSingle(),
    supabase
      .from("fuel_tanks")
      .select("name")
      .eq("id", row.fuel_tank_id)
      .eq("organization_id", orgId)
      .eq("establishment_id", estId)
      .maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", row.opened_by).maybeSingle(),
  ]);

  const fuelType = fuelTypeRes.data;
  const pricePerLiter = Number(row.price_per_liter ?? fuelType?.selling_price ?? 0);

  return {
    id: String(row.id),
    openedAt: String(row.opened_at),
    openedByName: profileRes.data?.full_name ?? null,
    fuelPumpId: String(row.fuel_pump_id),
    fuelPumpName: pumpRes.data?.name ? String(pumpRes.data.name) : "—",
    fuelTypeName: fuelType?.name ?? "—",
    fuelTankName: fuelTankRes.data?.name ? String(fuelTankRes.data.name) : "—",
    pricePerLiter,
    indexStart: Number(row.index_start),
    isInitialSession: Boolean(row.is_initial_session),
    activeFuelLineId: row.active_fuel_line_id ? String(row.active_fuel_line_id) : null,
    sheetManual:
      row.sheet_manual && typeof row.sheet_manual === "object"
        ? (row.sheet_manual as Record<string, unknown>)
        : null,
    sheetCarryForward:
      row.sheet_carry_forward && typeof row.sheet_carry_forward === "object"
        ? (row.sheet_carry_forward as Record<string, unknown>)
        : null,
  };
}

async function fetchOwnOpenSessionRow(
  workspace: WorkspaceContext,
  sessionId?: string,
): Promise<PumpSessionRow | null> {
  const supabase = await createClient();

  const run = (select: string) => {
    let query = scopedPumpSessions(supabase, workspace, select)
      .eq("status", "OPEN")
      .order("opened_at", { ascending: false });

    if (sessionId) {
      query = query.eq("id", sessionId).eq("opened_by", workspace.userId);
    } else {
      query = query.eq("opened_by", workspace.userId);
    }

    return query.limit(1).maybeSingle();
  };

  let { data, error } = await run(SESSION_ROW_SELECT_FULL);

  if (error?.code === "PGRST116") {
    return null;
  }

  if (error && /column|sheet_|is_initial|active_fuel/i.test(error.message)) {
    ({ data, error } = await run(SESSION_ROW_SELECT_BASE));
    if (error?.code === "PGRST116") {
      return null;
    }
  }

  if (error) {
    console.error("[fetchOwnOpenSessionRow]", error.message);
    return null;
  }

  return (data as PumpSessionRow | null) ?? null;
}

async function resolveOwnOpenSession(
  workspace: WorkspaceContext,
  sessionId?: string,
): Promise<OwnOpenPumpSession | null> {
  const row = await fetchOwnOpenSessionRow(workspace, sessionId);
  if (!row) return null;
  return hydrateOwnOpenSessionForSheet(row, workspace);
}

/** Topbar / layout — 1 seule requête légère. */
export const getOwnOpenPumpSessionSummary = cache(
  async function getOwnOpenPumpSessionSummary(
    workspace: WorkspaceContext,
  ): Promise<{ hasOwnSession: boolean; sessionOpenedAt?: string }> {
    const supabase = await createClient();
    const { data, error } = await scopedPumpSessions(
      supabase,
      workspace,
      "opened_at",
    )
      .eq("status", "OPEN")
      .eq("opened_by", workspace.userId)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return { hasOwnSession: false };
    }

    return {
      hasOwnSession: true,
      sessionOpenedAt: String((data as unknown as { opened_at: string }).opened_at),
    };
  },
);

export const getOwnOpenPumpSession = cache(async function getOwnOpenPumpSession(
  workspace: WorkspaceContext,
): Promise<OwnOpenPumpSession | null> {
  return resolveOwnOpenSession(workspace);
});

export async function getOwnOpenPumpSessionById(
  workspace: WorkspaceContext,
  sessionId: string,
): Promise<OwnOpenPumpSession | null> {
  return resolveOwnOpenSession(workspace, sessionId);
}

export const getOpenPumpSessionsHeldByOthers = cache(
  async function getOpenPumpSessionsHeldByOthers(
    workspace: WorkspaceContext,
  ): Promise<OtherOpenPumpSession[]> {
    const supabase = await createClient();

    const { data, error } = await scopedPumpSessions(
      supabase,
      workspace,
      "fuel_pump_id, active_fuel_line_id, opened_at, opened_by",
    )
      .eq("status", "OPEN")
      .neq("opened_by", workspace.userId);

    if (error || !data) {
      if (error) console.error("[getOpenPumpSessionsHeldByOthers]", error.message);
      return [];
    }

    const rows = data as unknown as Array<{
      fuel_pump_id: string;
      active_fuel_line_id: string | null;
      opened_at: string;
      opened_by: string;
    }>;

    const openedByIds = [...new Set(rows.map((row) => String(row.opened_by)))];
    const profileNames = new Map<string, string>();

    if (openedByIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", openedByIds);

      for (const profile of profiles ?? []) {
        profileNames.set(String(profile.id), String(profile.full_name ?? ""));
      }
    }

    return rows.map((row) => ({
      fuelLineId: row.active_fuel_line_id
        ? String(row.active_fuel_line_id)
        : String(row.fuel_pump_id),
      fuelPumpId: String(row.fuel_pump_id),
      openedAt: String(row.opened_at),
      openedByName: profileNames.get(String(row.opened_by)) ?? null,
    }));
  },
);

export const getLastClosedIndexEndByFuelLine = cache(
  async function getLastClosedIndexEndByFuelLine(
    workspace: WorkspaceContext,
    fuelLineIds: readonly string[],
  ): Promise<Record<string, number | null>> {
    const map: Record<string, number | null> = {};
    for (const id of fuelLineIds) map[id] = null;

    if (fuelLineIds.length === 0) return map;

    const supabase = await createClient();

    const { data, error } = await scopedPumpSessions(
      supabase,
      workspace,
      "active_fuel_line_id, index_end, closed_at",
    )
      .eq("status", "CLOSED")
      .in("active_fuel_line_id", [...fuelLineIds])
      .order("closed_at", { ascending: false });

    if (error || !data) {
      if (error) console.error("[getLastClosedIndexEndByFuelLine]", error.message);
      return map;
    }

    const rows = data as unknown as Array<{
      active_fuel_line_id: string | null;
      index_end: number | string | null;
    }>;

    for (const row of rows) {
      const lineId = row.active_fuel_line_id ? String(row.active_fuel_line_id) : null;
      if (!lineId || map[lineId] != null) continue;
      map[lineId] = row.index_end == null ? null : Number(row.index_end);
    }

    return map;
  },
);

/** @deprecated Préférer getLastClosedIndexEndByFuelLine. */
export const getLastClosedIndexEndByPump = getLastClosedIndexEndByFuelLine;

/** @deprecated Préférer getLastClosedIndexEndByPump avec la liste des pompes actives. */
export async function getEstablishmentLastClosedIndexEndByPump(
  workspace: WorkspaceContext,
): Promise<Record<string, number | null>> {
  const pumps = await listActivePumpsForPumpSelection(workspace);
  return getLastClosedIndexEndByPump(
    workspace,
    pumps.map((pump) => pump.id),
  );
}

export const getStationSheetBootstrap = cache(async function getStationSheetBootstrap(
  workspace: WorkspaceContext,
): Promise<StationSheetBootstrap> {
  const supabase = await createClient();

  const { data: lastClosed, error } = await scopedPumpSessions(
    supabase,
    workspace,
    "sheet_closed_snapshot",
  )
    .eq("status", "CLOSED")
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && /column|sheet_closed_snapshot/i.test(error.message)) {
    return { isInitialSession: true, carryForward: null };
  }

  if (error) {
    console.error("[getStationSheetBootstrap]", error.message);
    return { isInitialSession: true, carryForward: null };
  }

  if (!lastClosed) {
    return { isInitialSession: true, carryForward: null };
  }

  const snapshot = (lastClosed as { sheet_closed_snapshot?: unknown }).sheet_closed_snapshot;
  const carryForward =
    snapshot &&
    typeof snapshot === "object" &&
    "carryForward" in snapshot &&
    snapshot.carryForward &&
    typeof snapshot.carryForward === "object"
      ? (snapshot.carryForward as Record<string, unknown>)
      : null;

  return { isInitialSession: false, carryForward };
});

export const getPumpSessionOpenState = cache(async function getPumpSessionOpenState(
  workspace: WorkspaceContext,
): Promise<{
  ownSession: OwnOpenPumpSession | null;
  otherOpenSessions: OtherOpenPumpSession[];
}> {
  const [ownSession, otherOpenSessions] = await Promise.all([
    getOwnOpenPumpSession(workspace),
    getOpenPumpSessionsHeldByOthers(workspace),
  ]);

  return { ownSession, otherOpenSessions };
});

export const getStationSheetPrices = cache(async function getStationSheetPrices(
  _workspace: WorkspaceContext,
): Promise<StationSheetPrices> {
  return DEFAULT_SHEET_PRICES;
});

export type PompisteSessionPageData = {
  ownSession: OwnOpenPumpSession | null;
  sheetBootstrap: StationSheetBootstrap;
  prices: StationSheetPrices;
  /** @deprecated Conservé pour compatibilité — toujours []. */
  otherOpenSessions: OtherOpenPumpSession[];
};

/** Entrée unique page session pompiste — 2 requêtes parallèles (session + bootstrap). */
export const getPompisteSessionPageData = cache(async function getPompisteSessionPageData(
  workspace: WorkspaceContext,
): Promise<PompisteSessionPageData> {
  const [ownSession, sheetBootstrap] = await Promise.all([
    getOwnOpenPumpSession(workspace),
    getStationSheetBootstrap(workspace),
  ]);

  return {
    ownSession,
    sheetBootstrap,
    prices: DEFAULT_SHEET_PRICES,
    otherOpenSessions: [],
  };
});
