import "server-only";

import { cache } from "react";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type {
  FuelDeliveryItem,
  FuelLossItem,
  FuelTankGaugeItem,
  StationCreditItem,
  StationCreditPaymentItem,
  FuelTankItem,
  FuelTankOption,
  FuelTypeItem,
  FuelTypeOption,
  FuelPumpItem,
} from "@/lib/station/types";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export const listFuelTypes = cache(async function listFuelTypes(
  workspace: WorkspaceContext,
): Promise<FuelTypeItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fuel_types")
    .select("id, name, selling_price, minimum_stock, active, sort_order")
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("sort_order")
    .order("name");

  if (error || !data) {
    if (error) console.error("[listFuelTypes]", error.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    selling_price: Number(row.selling_price),
    minimum_stock: Number(row.minimum_stock),
    active: row.active,
    sort_order: row.sort_order ?? 0,
  }));
});

export const listFuelTanks = cache(async function listFuelTanks(
  workspace: WorkspaceContext,
): Promise<FuelTankItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fuel_tanks")
    .select(
      "id, name, fuel_type_id, capacity, current_volume, minimum_volume, active, fuel_types(name)",
    )
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("name");

  if (error || !data) {
    if (error) console.error("[listFuelTanks]", error.message);
    return [];
  }

  return data.map((row) => {
    const fuelType = readSingle(
      row.fuel_types as { name: string } | { name: string }[] | null,
    );
    return {
      id: row.id,
      name: row.name,
      fuel_type_id: row.fuel_type_id,
      fuel_type_name: fuelType?.name ?? "—",
      capacity: Number(row.capacity),
      current_volume: Number(row.current_volume),
      minimum_volume: Number(row.minimum_volume),
      active: row.active,
    };
  });
});

export const listFuelPumps = cache(async function listFuelPumps(
  workspace: WorkspaceContext,
): Promise<FuelPumpItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fuel_pumps")
    .select(
      "id, name, fuel_type_id, fuel_tank_id, current_index, active, fuel_types(name), fuel_tanks(name)",
    )
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("name");

  if (error || !data) {
    if (error) console.error("[listFuelPumps]", error.message);
    return [];
  }

  return data.map((row) => {
    const fuelType = readSingle(
      row.fuel_types as { name: string } | { name: string }[] | null,
    );
    const fuelTank = readSingle(
      row.fuel_tanks as { name: string } | { name: string }[] | null,
    );
    return {
      id: row.id,
      name: row.name,
      fuel_type_id: row.fuel_type_id,
      fuel_type_name: fuelType?.name ?? "—",
      fuel_tank_id: row.fuel_tank_id,
      fuel_tank_name: fuelTank?.name ?? "—",
      current_index: Number(row.current_index),
      active: row.active,
    };
  });
});

export const listFuelTypesForSelect = cache(async function listFuelTypesForSelect(
  workspace: WorkspaceContext,
): Promise<FuelTypeOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fuel_types")
    .select("id, name")
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("sort_order")
    .order("name");

  if (error || !data) return [];
  return data;
});

export const listFuelTanksForSelect = cache(async function listFuelTanksForSelect(
  workspace: WorkspaceContext,
  fuelTypeId?: string,
): Promise<FuelTankOption[]> {
  const supabase = await createClient();

  let query = supabase
    .from("fuel_tanks")
    .select("id, name")
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .eq("active", true)
    .order("name");

  if (fuelTypeId) {
    query = query.eq("fuel_type_id", fuelTypeId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data;
});

export async function listFuelDeliveries(
  workspace: WorkspaceContext,
  options: { from?: string; to?: string; fuelTankId?: string; limit?: number } = {},
): Promise<FuelDeliveryItem[]> {
  const supabase = await createClient();
  const limit = options.limit ?? 30;

  let query = supabase
    .from("fuel_deliveries")
    .select(
      "id, received_on, quantity, purchase_price_per_liter, total_cost, volume_before, volume_after, notes, supplier_id, suppliers(name), fuel_tank_id, fuel_tanks(name), fuel_type_id, fuel_types(name)",
    )
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("received_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.from) query = query.gte("received_on", options.from);
  if (options.to) query = query.lte("received_on", options.to);
  if (options.fuelTankId) query = query.eq("fuel_tank_id", options.fuelTankId);

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("[listFuelDeliveries]", error.message);
    return [];
  }

  return data.map((row) => {
    const supplier = readSingle(
      row.suppliers as { name: string } | { name: string }[] | null,
    );
    const tank = readSingle(
      row.fuel_tanks as { name: string } | { name: string }[] | null,
    );
    const fuelType = readSingle(
      row.fuel_types as { name: string } | { name: string }[] | null,
    );

    return {
      id: row.id,
      receivedOn: String(row.received_on),
      supplierName: supplier?.name ?? null,

      fuelTankId: row.fuel_tank_id,
      fuelTankName: tank?.name ?? "—",
      fuelTypeName: fuelType?.name ?? "—",

      quantity: Number(row.quantity),
      purchasePricePerLiter:
        row.purchase_price_per_liter == null ? null : Number(row.purchase_price_per_liter),
      totalCost: row.total_cost == null ? null : Number(row.total_cost),
      volumeBefore: row.volume_before == null ? null : Number(row.volume_before),
      volumeAfter: row.volume_after == null ? null : Number(row.volume_after),

      notes: row.notes ?? null,
    };
  });
}

export async function listFuelLosses(
  workspace: WorkspaceContext,
  options: { from?: string; to?: string; fuelTankId?: string; limit?: number } = {},
): Promise<FuelLossItem[]> {
  const supabase = await createClient();
  const limit = options.limit ?? 30;

  let query = supabase
    .from("fuel_losses")
    .select(
      "id, loss_date, quantity, reason, fuel_tank_id, fuel_tanks(name), fuel_type_id, fuel_types(name)",
    )
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("loss_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.from) query = query.gte("loss_date", options.from);
  if (options.to) query = query.lte("loss_date", options.to);
  if (options.fuelTankId) query = query.eq("fuel_tank_id", options.fuelTankId);

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("[listFuelLosses]", error.message);
    return [];
  }

  return data.map((row) => {
    const tank = readSingle(
      row.fuel_tanks as { name: string } | { name: string }[] | null,
    );
    const fuelType = readSingle(
      row.fuel_types as { name: string } | { name: string }[] | null,
    );

    return {
      id: row.id,
      lossDate: String(row.loss_date),
      reason: row.reason,

      fuelTankId: row.fuel_tank_id,
      fuelTankName: tank?.name ?? "—",
      fuelTypeName: fuelType?.name ?? "—",

      quantity: Number(row.quantity),
      notes: null,
    };
  });
}

export async function listFuelTankGauges(
  workspace: WorkspaceContext,
  options: { from?: string; to?: string; fuelTankId?: string; limit?: number } = {},
): Promise<FuelTankGaugeItem[]> {
  const supabase = await createClient();
  const limit = options.limit ?? 30;

  let query = supabase
    .from("fuel_tank_gauges")
    .select(
      "id, gauged_on, theoretical_volume, actual_volume, difference, notes, fuel_tank_id, fuel_tanks(name, fuel_types(name))",
    )
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("gauged_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.from) query = query.gte("gauged_on", options.from);
  if (options.to) query = query.lte("gauged_on", options.to);
  if (options.fuelTankId) query = query.eq("fuel_tank_id", options.fuelTankId);

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("[listFuelTankGauges]", error.message);
    return [];
  }

  return data.map((row) => {
    const tank = readSingle(
      row.fuel_tanks as
        | { name: string; fuel_types?: { name: string } | { name: string }[] | null }
        | Array<{ name: string; fuel_types?: { name: string } | { name: string }[] | null }>
        | null,
    );

    const fuelType = tank?.fuel_types
      ? readSingle(tank.fuel_types as { name: string } | { name: string }[] | null)
      : null;

    return {
      id: row.id,
      gaugedOn: String(row.gauged_on),
      fuelTankId: row.fuel_tank_id,
      fuelTankName: tank?.name ?? "—",

      theoreticalVolume: Number(row.theoretical_volume),
      actualVolume: Number(row.actual_volume),
      difference: Number(row.difference),

      notes: row.notes ?? null,
      corrected: false,
    };
  });
}

export async function listStationCredits(
  workspace: WorkspaceContext,
  options: { from?: string; to?: string; status?: string; limit?: number } = {},
): Promise<StationCreditItem[]> {
  const supabase = await createClient();
  const limit = options.limit ?? 60;

  let query = supabase
    .from("station_credits")
    .select("id, customer_name, customer_phone, liters, amount, amount_paid, status, credit_date, notes")
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("credit_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.from) query = query.gte("credit_date", options.from);
  if (options.to) query = query.lte("credit_date", options.to);
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("[listStationCredits]", error.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone ?? null,
    liters: row.liters == null ? null : Number(row.liters),
    amount: Number(row.amount),
    amountPaid: Number(row.amount_paid),
    status: row.status as StationCreditItem["status"],
    creditDate: String(row.credit_date),
    notes: row.notes ?? null,
  }));
}

export async function listStationCreditPayments(
  workspace: WorkspaceContext,
  stationCreditId: string,
  options: { limit?: number } = {},
): Promise<StationCreditPaymentItem[]> {
  const supabase = await createClient();
  const limit = options.limit ?? 40;

  const { data: paymentsRows, error } = await supabase
    .from("station_credit_payments")
    .select("id, station_credit_id, amount, method, received_at, received_by, notes")
    .eq("station_credit_id", stationCreditId)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error || !paymentsRows) return [];

  const receivedByIds = Array.from(
    new Set(
      paymentsRows
        .map((p: any) => p.received_by)
        .filter((id: any): id is string => Boolean(id)),
    ),
  );

  const { data: profilesRows } = receivedByIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", receivedByIds)
    : { data: [] as Array<{ id: string; full_name: string }> };

  const byId = new Map<string, string>(
    (profilesRows ?? []).map((p: any) => [p.id, p.full_name]),
  );

  return paymentsRows.map((p: any) => ({
    id: p.id,
    stationCreditId: p.station_credit_id,
    method: p.method,
    amount: Number(p.amount),
    receivedAt: String(p.received_at),
    receivedByName: byId.get(p.received_by) ?? null,
    notes: p.notes ?? null,
  }));
}

export type StationCreditPaymentWithCreditDateItem = {
  id: string;
  stationCreditId: string;
  amount: number;
  receivedAt: string;
  creditDate: string;
};

export async function listStationCreditPaymentsByDateRange(
  workspace: WorkspaceContext,
  options: { from?: string; to?: string; limit?: number } = {},
): Promise<StationCreditPaymentWithCreditDateItem[]> {
  const supabase = await createClient();
  const limit = options.limit ?? 2000;

  let paymentsQuery = supabase
    .from("station_credit_payments")
    .select("id, station_credit_id, amount, received_at")
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (options.from) paymentsQuery = paymentsQuery.gte("received_at", `${options.from}T00:00:00.000Z`);
  if (options.to) paymentsQuery = paymentsQuery.lte("received_at", `${options.to}T23:59:59.999Z`);

  const { data: paymentsRows, error } = await paymentsQuery;
  if (error || !paymentsRows) {
    if (error) console.error("[listStationCreditPaymentsByDateRange]", error.message);
    return [];
  }

  const creditIds = Array.from(
    new Set(paymentsRows.map((p: any) => p.station_credit_id).filter(Boolean)),
  ) as string[];

  const { data: creditsRows } = creditIds.length
    ? await supabase
        .from("station_credits")
        .select("id, credit_date")
        .eq("organization_id", workspace.organizationId)
        .eq("establishment_id", workspace.establishmentId)
        .in("id", creditIds)
    : { data: [] as Array<{ id: string; credit_date: string } | null> };

  const byCreditId = new Map<string, string>(
    (creditsRows ?? [])
      .filter(Boolean)
      .map((c: any) => [String(c.id), String(c.credit_date)]),
  );

  return (paymentsRows ?? []).map((p: any) => ({
    id: p.id,
    stationCreditId: String(p.station_credit_id),
    amount: Number(p.amount),
    receivedAt: String(p.received_at),
    creditDate: byCreditId.get(String(p.station_credit_id)) ?? "—",
  }));
}
