"use server";

import { revalidatePath } from "next/cache";

import { requireGasStationAdminMutationContext } from "@/lib/auth/workspace-context";
import {
  createFuelTypeSchema,
  updateFuelTypeSchema,
  toggleFuelTypeSchema,
  createFuelTankSchema,
  updateFuelTankSchema,
  createFuelPumpSchema,
  updateFuelPumpSchema,
  recordFuelDeliverySchema,
  recordFuelLossSchema,
  recordFuelTankGaugeSchema,
} from "@/lib/station/schemas";
import {
  createAdminClient,
  isAdminClientConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { toUserFacingError } from "@/lib/errors/user-facing";
import { writeAuditLogEntry } from "@/lib/stock/audit";

type ActionResult = { success?: string; error?: string };

const STATION_PATHS = [
  "/application/station/carburants",
  "/application/station/cuves",
  "/application/station/pompes",
  "/application/station/approvisionnements",
  "/application/station/pertes",
  "/application/station/controle-cuves",
] as const;

function revalidateStation() {
  for (const path of STATION_PATHS) {
    revalidatePath(path);
  }
}

function getWriteClient() {
  return isAdminClientConfigured() ? createAdminClient() : null;
}

export async function createFuelTypeAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const workspace = await requireGasStationAdminMutationContext();

  const parsed = createFuelTypeSchema.safeParse({
    name: formData.get("name"),
    sellingPrice: formData.get("sellingPrice"),
    minimumStock: formData.get("minimumStock"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const writeClient = getWriteClient() ?? supabase;

  const { data: maxSort } = await supabase
    .from("fuel_types")
    .select("sort_order")
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort = ((maxSort?.sort_order as number) ?? 0) + 1;

  const { data: created, error } = await writeClient
    .from("fuel_types")
    .insert({
      organization_id: workspace.organizationId,
      establishment_id: workspace.establishmentId,
      name: parsed.data.name,
      selling_price: parsed.data.sellingPrice,
      minimum_stock: parsed.data.minimumStock,
      active: true,
      sort_order: nextSort,
      created_by: workspace.userId,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    console.error("[createFuelTypeAction]", error?.message);
    return { error: error?.message ?? "Échec de la création du carburant." };
  }

  await writeClient.from("fuel_type_prices").insert({
    fuel_type_id: created.id,
    organization_id: workspace.organizationId,
    establishment_id: workspace.establishmentId,
    price: parsed.data.sellingPrice,
    effective_at: new Date().toISOString(),
    changed_by: workspace.userId,
  });

  revalidateStation();
  return { success: "Carburant ajouté." };
}

export async function updateFuelTypeAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const workspace = await requireGasStationAdminMutationContext();

  const parsed = updateFuelTypeSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    sellingPrice: formData.get("sellingPrice"),
    minimumStock: formData.get("minimumStock"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const writeClient = getWriteClient() ?? supabase;

  const { data: existing } = await supabase
    .from("fuel_types")
    .select("selling_price")
    .eq("id", parsed.data.id)
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId)
    .maybeSingle();

  const { error } = await writeClient
    .from("fuel_types")
    .update({
      name: parsed.data.name,
      selling_price: parsed.data.sellingPrice,
      minimum_stock: parsed.data.minimumStock,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId);

  if (error) {
    console.error("[updateFuelTypeAction]", error.message);
    return { error: error.message ?? "Échec de la mise à jour." };
  }

  if (existing && Number(existing.selling_price) !== parsed.data.sellingPrice) {
    await writeClient.from("fuel_type_prices").insert({
      fuel_type_id: parsed.data.id,
      organization_id: workspace.organizationId,
      establishment_id: workspace.establishmentId,
      price: parsed.data.sellingPrice,
      effective_at: new Date().toISOString(),
      changed_by: workspace.userId,
    });
  }

  revalidateStation();
  return { success: "Carburant mis à jour." };
}

export async function toggleFuelTypeAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const workspace = await requireGasStationAdminMutationContext();

  const parsed = toggleFuelTypeSchema.safeParse({
    id: formData.get("id"),
    active: formData.get("active"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Action invalide." };
  }

  const writeClient = getWriteClient() ?? (await createClient());

  const { error } = await writeClient
    .from("fuel_types")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.id)
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId);

  if (error) {
    return { error: error.message ?? "Échec du changement de statut." };
  }

  revalidateStation();
  return { success: parsed.data.active ? "Carburant activé." : "Carburant désactivé." };
}

export async function createFuelTankAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const workspace = await requireGasStationAdminMutationContext();

  const parsed = createFuelTankSchema.safeParse({
    name: formData.get("name"),
    fuelTypeId: formData.get("fuelTypeId"),
    capacity: formData.get("capacity"),
    minimumVolume: formData.get("minimumVolume"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const writeClient = getWriteClient() ?? (await createClient());

  const { error } = await writeClient
    .from("fuel_tanks")
    .insert({
      organization_id: workspace.organizationId,
      establishment_id: workspace.establishmentId,
      fuel_type_id: parsed.data.fuelTypeId,
      name: parsed.data.name,
      capacity: parsed.data.capacity,
      current_volume: 0,
      minimum_volume: parsed.data.minimumVolume,
      active: true,
      created_by: workspace.userId,
    });

  if (error) {
    console.error("[createFuelTankAction]", error.message);
    return { error: error.message ?? "Échec de la création de la cuve." };
  }

  revalidateStation();
  return { success: "Cuve ajoutée." };
}

export async function updateFuelTankAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const workspace = await requireGasStationAdminMutationContext();

  const parsed = updateFuelTankSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    fuelTypeId: formData.get("fuelTypeId"),
    capacity: formData.get("capacity"),
    minimumVolume: formData.get("minimumVolume"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const writeClient = getWriteClient() ?? (await createClient());

  const { error } = await writeClient
    .from("fuel_tanks")
    .update({
      name: parsed.data.name,
      fuel_type_id: parsed.data.fuelTypeId,
      capacity: parsed.data.capacity,
      minimum_volume: parsed.data.minimumVolume,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId);

  if (error) {
    return { error: error.message ?? "Échec de la mise à jour." };
  }

  revalidateStation();
  return { success: "Cuve mise à jour." };
}

export async function createFuelPumpAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const workspace = await requireGasStationAdminMutationContext();

  const parsed = createFuelPumpSchema.safeParse({
    name: formData.get("name"),
    fuelTypeId: formData.get("fuelTypeId"),
    fuelTankId: formData.get("fuelTankId"),
    initialIndex: formData.get("initialIndex"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const writeClient = getWriteClient() ?? (await createClient());

  const { error } = await writeClient
    .from("fuel_pumps")
    .insert({
      organization_id: workspace.organizationId,
      establishment_id: workspace.establishmentId,
      fuel_type_id: parsed.data.fuelTypeId,
      fuel_tank_id: parsed.data.fuelTankId,
      name: parsed.data.name,
      current_index: parsed.data.initialIndex,
      active: true,
      created_by: workspace.userId,
    });

  if (error) {
    console.error("[createFuelPumpAction]", error.message);
    return { error: error.message ?? "Échec de la création de la pompe." };
  }

  revalidateStation();
  return { success: "Pompe ajoutée." };
}

export async function updateFuelPumpAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const workspace = await requireGasStationAdminMutationContext();

  const parsed = updateFuelPumpSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    fuelTypeId: formData.get("fuelTypeId"),
    fuelTankId: formData.get("fuelTankId"),
    initialIndex: formData.get("initialIndex"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const writeClient = getWriteClient() ?? (await createClient());

  const { error } = await writeClient
    .from("fuel_pumps")
    .update({
      name: parsed.data.name,
      fuel_type_id: parsed.data.fuelTypeId,
      fuel_tank_id: parsed.data.fuelTankId,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", workspace.organizationId)
    .eq("establishment_id", workspace.establishmentId);

  if (error) {
    return { error: error.message ?? "Échec de la mise à jour." };
  }

  revalidateStation();
  return { success: "Pompe mise à jour." };
}

export async function recordFuelDeliveryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const workspace = await requireGasStationAdminMutationContext();

  const parsed = recordFuelDeliverySchema.safeParse({
    fuelTankId: formData.get("fuelTankId"),
    quantity: formData.get("quantity"),
    supplierId: formData.get("supplierId"),
    purchasePricePerLiter: formData.get("purchasePricePerLiter"),
    totalCost: formData.get("totalCost"),
    receivedOn: formData.get("receivedOn"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const writeClient = getWriteClient() ?? supabase;

  const { data: deliveryId, error } = await writeClient.rpc("record_fuel_delivery", {
    p_fuel_tank_id: parsed.data.fuelTankId,
    p_quantity: parsed.data.quantity,
    p_supplier_id: parsed.data.supplierId,
    p_purchase_price: parsed.data.purchasePricePerLiter,
    p_total_cost: parsed.data.totalCost,
    p_notes: parsed.data.notes ?? null,
    p_received_on: parsed.data.receivedOn,
  });

  if (error) {
    return { error: toUserFacingError(error) };
  }

  const entityId = deliveryId ? String(deliveryId) : parsed.data.fuelTankId;
  await writeAuditLogEntry({
    organizationId: workspace.organizationId,
    establishmentId: workspace.establishmentId,
    entityType: "fuel_delivery",
    entityId,
    action: "FUEL_DELIVERY_RECORDED",
    actorId: workspace.userId,
    metadata: {
      fuelTankId: parsed.data.fuelTankId,
      quantity: parsed.data.quantity,
      supplierId: parsed.data.supplierId,
      purchasePricePerLiter: parsed.data.purchasePricePerLiter ?? null,
      totalCost: parsed.data.totalCost ?? null,
      receivedOn: parsed.data.receivedOn,
    },
  });

  // Les réceptions impactent directement les volumes des cuves.
  revalidateStation();
  return { success: "Réception enregistrée." };
}

export async function recordFuelLossAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const workspace = await requireGasStationAdminMutationContext();

  const parsed = recordFuelLossSchema.safeParse({
    fuelTankId: formData.get("fuelTankId"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
    lossDate: formData.get("lossDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const writeClient = getWriteClient() ?? supabase;

  const { data: lossId, error } = await writeClient.rpc("record_fuel_loss", {
    p_fuel_tank_id: parsed.data.fuelTankId,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason,
    p_loss_date: parsed.data.lossDate,
  });

  if (error) {
    return { error: toUserFacingError(error) };
  }

  const entityId = lossId ? String(lossId) : parsed.data.fuelTankId;
  await writeAuditLogEntry({
    organizationId: workspace.organizationId,
    establishmentId: workspace.establishmentId,
    entityType: "fuel_loss",
    entityId,
    action: "FUEL_LOSS_RECORDED",
    actorId: workspace.userId,
    metadata: {
      fuelTankId: parsed.data.fuelTankId,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      lossDate: parsed.data.lossDate,
    },
  });

  revalidateStation();
  return { success: "Perte enregistrée." };
}

export async function recordFuelTankGaugeAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const workspace = await requireGasStationAdminMutationContext();

  const parsed = recordFuelTankGaugeSchema.safeParse({
    fuelTankId: formData.get("fuelTankId"),
    actualVolume: formData.get("actualVolume"),
    applyCorrection: formData.get("applyCorrection"),
    notes: formData.get("notes"),
    gaugedOn: formData.get("gaugedOn"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const writeClient = getWriteClient() ?? supabase;

  const { data: gaugeId, error } = await writeClient.rpc("record_fuel_tank_gauge", {
    p_fuel_tank_id: parsed.data.fuelTankId,
    p_actual_volume: parsed.data.actualVolume,
    p_apply_correction: parsed.data.applyCorrection,
    p_notes: parsed.data.notes ?? null,
    p_gauged_on: parsed.data.gaugedOn,
  });

  if (error) {
    return { error: toUserFacingError(error) };
  }

  const entityId = gaugeId ? String(gaugeId) : parsed.data.fuelTankId;
  await writeAuditLogEntry({
    organizationId: workspace.organizationId,
    establishmentId: workspace.establishmentId,
    entityType: "fuel_tank_gauge",
    entityId,
    action: "FUEL_GAUGE_RECORDED",
    actorId: workspace.userId,
    metadata: {
      fuelTankId: parsed.data.fuelTankId,
      actualVolume: parsed.data.actualVolume,
      applyCorrection: parsed.data.applyCorrection,
      notes: parsed.data.notes ?? null,
      gaugedOn: parsed.data.gaugedOn,
    },
  });

  revalidateStation();
  return { success: "Jaugeage enregistré." };
}
