import { notFound } from "next/navigation";

import { StationSessionSheet } from "@/components/station/station-session-sheet";
import { requireGasStationAdminContext } from "@/lib/auth/workspace-context";
import {
  computeStationSheet,
  parseSheetCarryForward,
  parseSheetManual,
  resolveFuelLineId,
  type FuelLineId,
} from "@/lib/station/sheet-engine";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function StationSessionDetailPage({ params }: PageProps) {
  const workspace = await requireGasStationAdminContext();
  const { sessionId } = await params;
  const supabase = await createClient();

  const [{ data: session }] = await Promise.all([
    supabase
      .from("pump_sessions")
      .select(
        "id, status, opened_at, index_start, index_end, price_per_liter, is_initial_session, active_fuel_line_id, sheet_manual, sheet_carry_forward, sheet_closed_snapshot, fuel_pumps(name), fuel_types(name), profiles!pump_sessions_opened_by_fkey(full_name)",
      )
      .eq("id", sessionId)
      .eq("organization_id", workspace.organizationId)
      .eq("establishment_id", workspace.establishmentId)
      .maybeSingle(),
  ]);

  if (!session || session.status !== "CLOSED") {
    notFound();
  }

  const fuelPump = readSingle(
    session.fuel_pumps as { name: string } | { name: string }[] | null,
  );
  const fuelType = readSingle(
    session.fuel_types as { name: string } | { name: string }[] | null,
  );
  const profile = readSingle(
    session.profiles as { full_name: string } | { full_name: string }[] | null,
  );

  const price = Number(session.price_per_liter ?? 0);
  const prices = { superPu: price, gazoilPu: price };
  const manual = parseSheetManual(
    session.sheet_manual as Record<string, unknown> | null,
    prices,
  );
  const carryForward = parseSheetCarryForward(
    session.sheet_carry_forward as Record<string, unknown> | null,
  );
  const activeFuelLineId = (session.active_fuel_line_id ??
    resolveFuelLineId(fuelType?.name ?? "", fuelPump?.name ?? "")) as FuelLineId;

  const computed = computeStationSheet({
    isInitialSession: Boolean(session.is_initial_session),
    activeFuelLineId,
    sessionIndexStart: Number(session.index_start),
    sessionIndexEnd: Number(session.index_end ?? session.index_start),
    carryForward,
    prices,
    manual,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-3 py-3 print:overflow-visible sm:px-4 sm:py-4">
      <header className="no-print shrink-0">
        <h1 className="text-[18px] font-bold text-slate-900">Fiche session clôturée</h1>
        <p className="mt-1 text-[12px] text-slate-600">
          {profile?.full_name ?? "Pompiste"} · {fuelPump?.name ?? "—"} ·{" "}
          {new Date(String(session.opened_at)).toLocaleString("fr-FR")}
        </p>
      </header>

      <StationSessionSheet
        stationName={workspace.establishmentName}
        pompisteName={profile?.full_name ?? "Pompiste"}
        openedAt={String(session.opened_at)}
        computed={computed}
        activeFuelLineId={activeFuelLineId}
        readOnly
      />
    </div>
  );
}
