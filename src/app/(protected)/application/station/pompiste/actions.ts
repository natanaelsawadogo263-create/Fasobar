"use server";
import { revalidatePath } from "next/cache";

import { requireGasStationOperatorMutationContext } from "@/lib/auth/workspace-context";
import { applyTenantFilter } from "@/lib/auth/tenant";
import { toUserFacingError } from "@/lib/errors/user-facing";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLogEntry } from "@/lib/stock/audit";
import {
  closePumpSessionSchemaWithCreditRules,
  openPumpSessionSchema,
} from "@/lib/station/schemas";
import {
  buildCarryForwardForNextSession,
  computeStationSheet,
  resolveFuelLineId,
  type FuelLineId,
  type StationSheetCarryForward,
  type StationSheetManual,
} from "@/lib/station/sheet-engine";
import type { PumpSessionActionState } from "@/lib/station/pump-session-types";
import { getOwnOpenPumpSessionById } from "@/lib/station/pump-session-queries";
import { revalidatePumpSessionOps } from "@/lib/ops/revalidate";

function mapRpcError(error: { message?: string; details?: string } | null): string {
  const message = [error?.message, error?.details].filter(Boolean).join(" ");

  if (/permission insuffisante/i.test(message)) {
    return "Permission insuffisante pour cette opération.";
  }

  if (
    message.includes("Authentification requise") ||
    message.includes("Non authentifié") ||
    /session expirée/i.test(message)
  ) {
    return "Session expirée. Veuillez vous reconnecter.";
  }

  if (message.includes("Pompe introuvable ou inactive")) {
    return "Pompe introuvable ou inactive.";
  }

  if (message.includes("Accès interdit")) {
    return "Accès interdit.";
  }

  if (message.includes("Une session est déjà ouverte sur cette pompe")) {
    return "Une session est déjà ouverte sur cette pompe.";
  }

  if (message.includes("Vous avez déjà une session ouverte")) {
    return "Vous avez déjà une session ouverte.";
  }

  if (message.includes("Seul le pompiste ayant ouvert la session peut la clôturer")) {
    return "Seul le pompiste ayant ouvert la session peut la clôturer.";
  }

  if (message.includes("Une session station est déjà ouverte pour cet établissement")) {
    return "Une session station est déjà ouverte pour cet établissement.";
  }

  if (message.includes("Session introuvable ou déjà clôturée")) {
    return "Session introuvable ou déjà clôturée.";
  }

  if (message.includes("index de fin ne peut pas être inférieur")) {
    return "L'index de fin ne peut pas être inférieur à l'index de début.";
  }

  return toUserFacingError(error);
}

export async function openPumpSessionAction(
  _prevState: PumpSessionActionState,
  formData: FormData,
): Promise<PumpSessionActionState> {
  const workspace = await requireGasStationOperatorMutationContext();

  const parsed = openPumpSessionSchema.safeParse({
    fuelPumpId: formData.get("fuelPumpId"),
    indexStart: formData.get("indexStart"),
    prefillIndexEnd: formData.get("prefillIndexEnd"),
    indexGapReason: formData.get("indexGapReason") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("open_pump_session", {
    p_fuel_pump_id: parsed.data.fuelPumpId,
    p_index_start: parsed.data.indexStart,
    p_note: null,
    p_index_gap_reason: parsed.data.indexGapReason ?? null,
  });

  if (error || !data) {
    return { error: mapRpcError(error) };
  }

  revalidatePumpSessionOps();
  revalidatePath("/application/station/pompiste/session");
  revalidatePath("/application/station/pompiste");

  const payload = data as { session_id?: string } | null;
  const sessionId = payload?.session_id ? String(payload.session_id) : null;

  let openedSession: PumpSessionActionState["openedSession"];

  if (sessionId) {
    const [pumpRes, closedCountRes, lastClosedRes] = await Promise.all([
      applyTenantFilter(
        supabase
          .from("fuel_pumps")
          .select("name, fuel_types(name)")
          .eq("id", parsed.data.fuelPumpId),
        workspace,
      ).maybeSingle(),
      applyTenantFilter(
        supabase
          .from("pump_sessions")
          .select("id", { count: "exact", head: true })
          .eq("status", "CLOSED"),
        workspace,
      ),
      applyTenantFilter(
        supabase
          .from("pump_sessions")
          .select("sheet_closed_snapshot")
          .eq("status", "CLOSED")
          .order("closed_at", { ascending: false })
          .limit(1),
        workspace,
      ).maybeSingle(),
    ]);

    const pumpRow = pumpRes.data;
    const fuelType = pumpRow?.fuel_types as { name?: string } | { name?: string }[] | null;
    const fuelTypeName = Array.isArray(fuelType)
      ? fuelType[0]?.name
      : fuelType?.name ?? "";
    const pumpName = pumpRow?.name ? String(pumpRow.name) : "";
    const activeFuelLineId = resolveFuelLineId(fuelTypeName ?? "", pumpName);

    const isInitialSession = (closedCountRes.count ?? 0) === 0;

    const snapshot = lastClosedRes.data?.sheet_closed_snapshot as
      | { carryForward?: StationSheetCarryForward }
      | null
      | undefined;

    const { error: sheetInitError } = await applyTenantFilter(
      supabase
        .from("pump_sessions")
        .update({
          is_initial_session: isInitialSession,
          active_fuel_line_id: activeFuelLineId,
          sheet_carry_forward: snapshot?.carryForward ?? null,
          sheet_manual: {},
        })
        .eq("id", sessionId)
        .eq("opened_by", workspace.userId)
        .eq("status", "OPEN"),
      workspace,
    );

    if (sheetInitError) {
      console.error("[openPumpSessionAction] sheet init", sheetInitError.message);
    }

    await writeAuditLogEntry({
      organizationId: workspace.organizationId,
      establishmentId: workspace.establishmentId,
      entityType: "pump_session",
      entityId: sessionId,
      action: "PUMP_SESSION_OPENED",
      actorId: workspace.userId,
      metadata: {
        fuelPumpId: parsed.data.fuelPumpId,
        indexStart: parsed.data.indexStart,
        indexGapReason: parsed.data.indexGapReason ?? null,
        activeFuelLineId,
        isInitialSession,
      },
    });
  }

  if (sessionId) {
    openedSession =
      (await getOwnOpenPumpSessionById(workspace, sessionId)) ?? undefined;
  }

  return {
    success: "Session pompe ouverte.",
    sessionId: sessionId ?? undefined,
    openedSession,
  };
}

export async function closePumpSessionAction(
  _prevState: PumpSessionActionState,
  formData: FormData,
): Promise<PumpSessionActionState> {
  const workspace = await requireGasStationOperatorMutationContext();

  const parsed = closePumpSessionSchemaWithCreditRules.safeParse({
    sessionId: formData.get("sessionId"),
    indexEnd: formData.get("indexEnd"),
    cashAmount: formData.get("cashAmount"),
    orangeMoneyAmount: formData.get("orangeMoneyAmount"),
    moovMoneyAmount: formData.get("moovMoneyAmount"),
    telecelMoneyAmount: formData.get("telecelMoneyAmount"),
    cardAmount: formData.get("cardAmount"),
    otherAmount: formData.get("otherAmount"),
    creditAmount: formData.get("creditAmount"),
    creditCustomerName: formData.get("creditCustomerName"),
    creditCustomerPhone: formData.get("creditCustomerPhone"),
  });

  let sheetManual: StationSheetManual | null = null;
  const sheetManualRaw = formData.get("sheetManual");
  if (typeof sheetManualRaw === "string" && sheetManualRaw.trim()) {
    try {
      sheetManual = JSON.parse(sheetManualRaw) as StationSheetManual;
    } catch {
      sheetManual = null;
    }
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const payments = [
    { method: "CASH", amount: parsed.data.cashAmount },
    { method: "ORANGE_MONEY", amount: parsed.data.orangeMoneyAmount },
    { method: "MOOV_MONEY", amount: parsed.data.moovMoneyAmount },
    { method: "TELECEL_MONEY", amount: parsed.data.telecelMoneyAmount },
    { method: "CARD", amount: parsed.data.cardAmount },
    { method: "OTHER", amount: parsed.data.otherAmount },
  ].filter((p) => p.amount > 0);

  const supabase = await createClient();

  const { data: rpcData, error } = await supabase.rpc("close_pump_session", {
    p_session_id: parsed.data.sessionId,
    p_index_end: parsed.data.indexEnd,
    p_payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
    p_credit_amount: parsed.data.creditAmount,
    p_note: null,
  });

  if (error) {
    return { error: mapRpcError(error) };
  }

  const sessionId = parsed.data.sessionId ? String(parsed.data.sessionId) : null;

  // Création du crédit station (OPEN) si le pompiste a autorisé un crédit.
  if (parsed.data.creditAmount > 0) {
    const litersSold = rpcData && "liters_sold" in rpcData ? Number((rpcData as any).liters_sold) : null;

    const { data: sessionFuelType } = await applyTenantFilter(
      supabase.from("pump_sessions").select("fuel_type_id").eq("id", parsed.data.sessionId),
      workspace,
    ).maybeSingle();

    const fuelTypeId = sessionFuelType?.fuel_type_id ?? null;

    const creditInsert = await supabase
      .from("station_credits")
      .insert({
        organization_id: workspace.organizationId,
        establishment_id: workspace.establishmentId,
        pump_session_id: parsed.data.sessionId,
        fuel_type_id: fuelTypeId,
        customer_name: parsed.data.creditCustomerName,
        customer_phone: parsed.data.creditCustomerPhone ?? null,
        liters: litersSold,
        amount: parsed.data.creditAmount,
        amount_paid: 0,
        status: "OPEN",
        created_by: workspace.userId,
      })
      .select("id")
      .maybeSingle();

    const creditId = creditInsert.data?.id ? String(creditInsert.data.id) : null;

    if (creditInsert.error) {
      return {
        error: creditInsert.error.message ?? "Impossible de créer le crédit station.",
      };
    }

    if (creditId) {
      await writeAuditLogEntry({
        organizationId: workspace.organizationId,
        establishmentId: workspace.establishmentId,
        entityType: "station_credit",
        entityId: creditId,
        action: "STATION_CREDIT_CREATED",
        actorId: workspace.userId,
        metadata: {
          pumpSessionId: parsed.data.sessionId,
          fuelTypeId,
          customerName: parsed.data.creditCustomerName,
          customerPhone: parsed.data.creditCustomerPhone ?? null,
          litersSold,
          amount: parsed.data.creditAmount,
        },
      });
    }
  }

  if (sessionId) {
    if (sheetManual) {
      await persistClosedSheetSnapshot(
        sessionId,
        workspace,
        parsed.data.indexEnd,
        sheetManual,
      );
    }

    await writeAuditLogEntry({
      organizationId: workspace.organizationId,
      establishmentId: workspace.establishmentId,
      entityType: "pump_session",
      entityId: sessionId,
      action: "PUMP_SESSION_CLOSED",
      actorId: workspace.userId,
      metadata: {
        indexEnd: parsed.data.indexEnd,
        creditAmount: parsed.data.creditAmount,
        cashDifference: (rpcData as { cash_difference?: number })?.cash_difference ?? null,
      },
    });
  }

  revalidatePumpSessionOps();
  revalidatePath("/application/station/pompiste/session");
  revalidatePath("/application/station/pompiste");
  revalidatePath("/application/station/bilans");
  return { success: "Session clôturée." };
}

export async function savePumpSessionSheetAction(input: {
  sessionId: string;
  sheetManual: StationSheetManual;
}): Promise<{ error?: string }> {
  const workspace = await requireGasStationOperatorMutationContext();
  const supabase = await createClient();

  const { error } = await applyTenantFilter(
    supabase
      .from("pump_sessions")
      .update({ sheet_manual: input.sheetManual })
      .eq("id", input.sessionId)
      .eq("opened_by", workspace.userId)
      .eq("status", "OPEN"),
    workspace,
  );

  if (error) {
    return { error: error.message ?? "Impossible d'enregistrer la fiche." };
  }

  return {};
}

async function persistClosedSheetSnapshot(
  sessionId: string,
  workspace: Awaited<ReturnType<typeof requireGasStationOperatorMutationContext>>,
  indexEnd: number,
  sheetManual: StationSheetManual,
): Promise<void> {
  const supabase = await createClient();

  const { data: sessionRow } = await applyTenantFilter(
    supabase
      .from("pump_sessions")
      .select(
        "index_start, price_per_liter, is_initial_session, active_fuel_line_id, sheet_carry_forward, fuel_types(name)",
      )
      .eq("id", sessionId)
      .eq("opened_by", workspace.userId),
    workspace,
  ).maybeSingle();

  if (!sessionRow) return;

  const fuelType = sessionRow.fuel_types as { name?: string } | { name?: string }[] | null;
  const fuelTypeName = Array.isArray(fuelType) ? fuelType[0]?.name : fuelType?.name;
  const price = Number(sessionRow.price_per_liter ?? 0);
  const activeFuelLineId = (sessionRow.active_fuel_line_id ??
    resolveFuelLineId(fuelTypeName ?? "", "")) as FuelLineId;

  const carryForward = sessionRow.sheet_carry_forward as StationSheetCarryForward | null;

  const computed = computeStationSheet({
    isInitialSession: Boolean(sessionRow.is_initial_session),
    activeFuelLineId,
    sessionIndexStart: Number(sessionRow.index_start),
    sessionIndexEnd: indexEnd,
    carryForward,
    prices: { superPu: price, gazoilPu: price },
    manual: sheetManual,
  });

  const nextCarry = buildCarryForwardForNextSession(computed, carryForward);

  await applyTenantFilter(
    supabase
      .from("pump_sessions")
      .update({
        sheet_manual: sheetManual,
        sheet_closed_snapshot: {
          carryForward: nextCarry,
          computed,
          manual: sheetManual,
          closedAt: new Date().toISOString(),
        },
      })
      .eq("id", sessionId)
      .eq("opened_by", workspace.userId),
    workspace,
  );
}

