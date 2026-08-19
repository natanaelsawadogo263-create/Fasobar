import "server-only";

import { cache } from "react";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { applyTenantFilter } from "@/lib/auth/tenant";
import type {
  OwnOpenPumpSession,
  OtherOpenPumpSession,
  PumpForSelect,
  StationSheetBootstrap,
} from "@/lib/station/pump-session-types";
import { getEstablishmentSettings } from "@/lib/settings/queries";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export const listActivePumpsForPumpSelection = cache(
  async function listActivePumpsForPumpSelection(
    workspace: WorkspaceContext,
  ): Promise<PumpForSelect[]> {
    const supabase = await createClient();

    const { data, error } = await applyTenantFilter(
      supabase
        .from("fuel_pumps")
        .select(
          "id, name, active, fuel_type_id, fuel_tank_id, fuel_types(name, selling_price), fuel_tanks(name)",
        )
        .eq("active", true)
        .order("name"),
      workspace,
    );

    if (error || !data) {
      if (error) console.error("[listActivePumpsForPumpSelection]", error.message);
      return [];
    }

    return data.map((row) => {
      const fuelType = readSingle(
        row.fuel_types as
          | { name: string; selling_price: number | string }[]
          | { name: string; selling_price: number | string }
          | null,
      );
      const fuelTank = readSingle(
        row.fuel_tanks as { name: string }[] | { name: string } | null,
      );

      return {
        id: String(row.id),
        name: String(row.name),
        fuelTypeName: fuelType?.name ?? "—",
        fuelTankName: fuelTank?.name ?? "—",
        pricePerLiter: Number(fuelType?.selling_price ?? 0),
      };
    });
  },
);

const SESSION_ROW_SELECT_FULL =
  "id, opened_at, opened_by, index_start, price_per_liter, fuel_pump_id, fuel_type_id, fuel_tank_id, is_initial_session, active_fuel_line_id, sheet_manual, sheet_carry_forward";

const SESSION_ROW_SELECT_BASE =
  "id, opened_at, opened_by, index_start, price_per_liter, fuel_pump_id, fuel_type_id, fuel_tank_id";

const SESSION_HYDRATED_SELECT = `${SESSION_ROW_SELECT_FULL}, fuel_pumps(name), fuel_types(name, selling_price), fuel_tanks(name), profiles!pump_sessions_opened_by_fkey(full_name)`;

type PumpSessionRow = {
  id: string;
  opened_at: string;
  opened_by: string;
  index_start: number | string;
  price_per_liter: number | string;
  fuel_pump_id: string;
  fuel_type_id: string;
  fuel_tank_id: string;
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

function mapSessionRowToOwnOpen(row: PumpSessionRow): OwnOpenPumpSession {
  const fuelPump = readSingle(row.fuel_pumps ?? null);
  const fuelType = readSingle(row.fuel_types ?? null);
  const fuelTank = readSingle(row.fuel_tanks ?? null);
  const profile = readSingle(row.profiles ?? null);
  const pricePerLiter = Number(row.price_per_liter ?? fuelType?.selling_price ?? 0);

  return {
    id: String(row.id),
    openedAt: String(row.opened_at),
    openedByName: profile?.full_name ?? null,
    fuelPumpId: String(row.fuel_pump_id),
    fuelPumpName: fuelPump?.name ?? "—",
    fuelTypeName: fuelType?.name ?? "—",
    fuelTankName: fuelTank?.name ?? "—",
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
    let query = applyTenantFilter(supabase.from("pump_sessions").select(select), workspace)
      .eq("status", "OPEN");

    if (sessionId) {
      query = query.eq("id", sessionId).eq("opened_by", workspace.userId);
    } else {
      query = query.eq("opened_by", workspace.userId);
    }

    return query.maybeSingle();
  };

  let { data, error } = await run(SESSION_ROW_SELECT_FULL);

  if (error && /column|sheet_|is_initial|active_fuel/i.test(error.message)) {
    ({ data, error } = await run(SESSION_ROW_SELECT_BASE));
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
  const supabase = await createClient();

  const runHydrated = () => {
    let query = applyTenantFilter(
      supabase.from("pump_sessions").select(SESSION_HYDRATED_SELECT),
      workspace,
    )
      .eq("status", "OPEN");

    if (sessionId) {
      query = query.eq("id", sessionId).eq("opened_by", workspace.userId);
    } else {
      query = query.eq("opened_by", workspace.userId);
    }

    return query.maybeSingle();
  };

  let { data, error } = await runHydrated();

  if (!error && data) {
    return mapSessionRowToOwnOpen(data as PumpSessionRow);
  }

  if (error && !/column|sheet_|relationship|is_initial|active_fuel/i.test(error.message)) {
    console.error("[resolveOwnOpenSession]", error.message);
    return null;
  }

  const row = await fetchOwnOpenSessionRow(workspace, sessionId);
  if (!row) return null;
  return hydrateOwnOpenSessionSplit(row, workspace);
}

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

    const { data, error } = await applyTenantFilter(
      supabase
        .from("pump_sessions")
        .select("fuel_pump_id, opened_at, opened_by")
        .eq("status", "OPEN")
        .neq("opened_by", workspace.userId),
      workspace,
    );

    if (error || !data) {
      if (error) console.error("[getOpenPumpSessionsHeldByOthers]", error.message);
      return [];
    }

    const openedByIds = [...new Set(data.map((row) => String(row.opened_by)))];
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

    return data.map((row) => ({
      fuelPumpId: String(row.fuel_pump_id),
      openedAt: String(row.opened_at),
      openedByName: profileNames.get(String(row.opened_by)) ?? null,
    }));
  },
);

export const getLastClosedIndexEndByPump = cache(
  async function getLastClosedIndexEndByPump(
    workspace: WorkspaceContext,
    fuelPumpIds: readonly string[],
  ): Promise<Record<string, number | null>> {
    const map: Record<string, number | null> = {};
    for (const id of fuelPumpIds) map[id] = null;

    if (fuelPumpIds.length === 0) return map;

    const supabase = await createClient();

    const { data, error } = await applyTenantFilter(
      supabase
        .from("pump_sessions")
        .select("fuel_pump_id, index_end, closed_at")
        .eq("status", "CLOSED")
        .in("fuel_pump_id", fuelPumpIds)
        .order("closed_at", { ascending: false }),
      workspace,
    );

    if (error || !data) {
      if (error) console.error("[getLastClosedIndexEndByPump]", error.message);
      return map;
    }

    for (const row of data) {
      const pumpId = String(row.fuel_pump_id);
      if (map[pumpId] != null) continue;
      map[pumpId] = row.index_end == null ? null : Number(row.index_end);
    }

    return map;
  },
);

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

  const { count, error: countError } = await applyTenantFilter(
    supabase
      .from("pump_sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "CLOSED"),
    workspace,
  );

  if (countError) {
    console.error("[getStationSheetBootstrap]", countError.message);
  }

  const isInitialSession = (count ?? 0) === 0;
  if (isInitialSession) {
    return { isInitialSession: true, carryForward: null };
  }

  let { data: lastClosed, error } = await applyTenantFilter(
    supabase
      .from("pump_sessions")
      .select("sheet_closed_snapshot")
      .eq("status", "CLOSED")
      .order("closed_at", { ascending: false })
      .limit(1),
    workspace,
  ).maybeSingle();

  if (error && /column|sheet_closed_snapshot/i.test(error.message)) {
    ({ data: lastClosed, error } = await applyTenantFilter(
      supabase
        .from("pump_sessions")
        .select("id")
        .eq("status", "CLOSED")
        .order("closed_at", { ascending: false })
        .limit(1),
      workspace,
    ).maybeSingle());
  }

  if (error) {
    console.error("[getStationSheetBootstrap]", error.message);
  }

  const snapshot = lastClosed?.sheet_closed_snapshot;
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

export type PompisteSessionPageData = {
  ownSession: OwnOpenPumpSession | null;
  otherOpenSessions: OtherOpenPumpSession[];
  pumps: PumpForSelect[];
  sheetBootstrap: StationSheetBootstrap;
  lastClosedIndexEndByPump: Record<string, number | null>;
  settings: Awaited<ReturnType<typeof getEstablishmentSettings>>;
};

/** Une seule entrée page session pompiste — requêtes parallèles + cache React. */
export const getPompisteSessionPageData = cache(async function getPompisteSessionPageData(
  workspace: WorkspaceContext,
): Promise<PompisteSessionPageData> {
  const pumps = await listActivePumpsForPumpSelection(workspace);

  const [openState, sheetBootstrap, settings, lastClosedIndexEndByPump] =
    await Promise.all([
      getPumpSessionOpenState(workspace),
      getStationSheetBootstrap(workspace),
      getEstablishmentSettings(workspace),
      getLastClosedIndexEndByPump(
        workspace,
        pumps.map((pump) => pump.id),
      ),
    ]);

  return {
    ownSession: openState.ownSession,
    otherOpenSessions: openState.otherOpenSessions,
    pumps,
    sheetBootstrap,
    lastClosedIndexEndByPump,
    settings,
  };
});
