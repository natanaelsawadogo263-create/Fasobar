import { z } from "zod";
import { paymentMethodSchema } from "@/lib/payments/schemas";

export const createFuelTypeSchema = z.object({
  name: z.string().trim().min(1, "Le nom du carburant est obligatoire."),
  sellingPrice: z.coerce
    .number()
    .int("Le prix doit être un nombre entier.")
    .positive("Le prix de vente doit être positif."),
  minimumStock: z.coerce
    .number()
    .min(0, "Le stock minimum doit être positif ou nul.")
    .default(0),
});

export const updateFuelTypeSchema = createFuelTypeSchema.extend({
  id: z.string().uuid("Carburant invalide."),
});

export const toggleFuelTypeSchema = z.object({
  id: z.string().uuid("Carburant invalide."),
  active: z.coerce.boolean(),
});

export const createFuelTankSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la cuve est obligatoire."),
  fuelTypeId: z.string().uuid("Sélectionnez un type de carburant."),
  capacity: z.coerce
    .number()
    .positive("La capacité doit être strictement positive."),
  minimumVolume: z.coerce
    .number()
    .min(0, "Le volume minimum doit être positif ou nul.")
    .default(0),
});

export const updateFuelTankSchema = createFuelTankSchema.extend({
  id: z.string().uuid("Cuve invalide."),
});

export const createFuelPumpSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la pompe est obligatoire."),
  fuelTypeId: z.string().uuid("Sélectionnez un type de carburant."),
  fuelTankId: z.string().uuid("Sélectionnez une cuve."),
  initialIndex: z.coerce
    .number()
    .min(0, "L'index initial doit être positif ou nul.")
    .default(0),
});

export const updateFuelPumpSchema = createFuelPumpSchema.extend({
  id: z.string().uuid("Pompe invalide."),
});

function roundIndex3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Ouverture de session pompiste.
 *
 * Règle UI/UX :
 * - Si `indexStart` diffère du pré-remplissage (`prefillIndexEnd`),
 *   alors `indexGapReason` devient obligatoire.
 */
export const openPumpSessionSchema = z
  .object({
    fuelPumpId: z.string().uuid("Pompe invalide."),
    indexStart: z.coerce
      .number()
      .min(0, "L'index de début doit être positif ou nul."),
    prefillIndexEnd: z.coerce
      .number()
      .min(0, "Index de pré-remplissage invalide."),
    indexGapReason: z
      .string()
      .trim()
      .min(3, "Le motif de l'écart d'index doit contenir au moins 3 caractères.")
      .optional(),
  })
  .superRefine((data, ctx) => {
    const mismatch =
      roundIndex3(data.indexStart) !== roundIndex3(data.prefillIndexEnd);
    if (!mismatch) return;

    if (!data.indexGapReason || data.indexGapReason.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Motif obligatoire en cas d'écart d'index.",
        path: ["indexGapReason"],
      });
    }
  });

/**
 * Clôture de session pompiste.
 *
 * Montants: entiers FCFA, selon les méthodes exigées par l'UI.
 */
export const closePumpSessionSchema = z.object({
  sessionId: z.string().uuid("Session invalide."),

  indexEnd: z.coerce
    .number()
    .min(0, "L'index de fin doit être positif ou nul."),

  cashAmount: z.coerce.number().int().min(0, "Montant espèces invalide."),
  orangeMoneyAmount: z
    .coerce
    .number()
    .int()
    .min(0, "Montant Orange Money invalide."),
  moovMoneyAmount: z
    .coerce
    .number()
    .int()
    .min(0, "Montant Moov Money invalide."),
  telecelMoneyAmount: z
    .coerce
    .number()
    .int()
    .min(0, "Montant Telecel Money invalide."),
  cardAmount: z.coerce.number().int().min(0, "Montant carte invalide."),
  otherAmount: z.coerce.number().int().min(0, "Autre montant invalide."),

  /** Ventes autorisées en crédit (FCFA). */
  creditAmount: z.coerce
    .number()
    .int()
    .min(0, "Montant crédit invalide."),

  creditCustomerName: z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") return undefined;
      return value;
    },
    z.string().trim().min(3, "Nom client requis (min. 3 caractères).").optional(),
  ),
  creditCustomerPhone: z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") return undefined;
      return value;
    },
    z.string().trim().optional(),
  ),
});

// Si crédit > 0 : le client doit être renseigné.
export const closePumpSessionSchemaWithCreditRules = closePumpSessionSchema.superRefine(
  (data, ctx) => {
    if (data.creditAmount <= 0) return;

    if (!data.creditCustomerName || data.creditCustomerName.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nom client requis pour une vente à crédit.",
        path: ["creditCustomerName"],
      });
    }
  },
);

function optionalNullableUuid(message: string) {
  return z.preprocess((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    return value;
  }, z.string().uuid(message).nullable());
}

function optionalNullablePositiveInt(message: string) {
  return z.preprocess((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }, z.number().int().min(1, message).nullable());
}

function optionalNullableDate() {
  return z.preprocess((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    return value;
  }, z.coerce.date().nullable());
}

function optionalNullableTrimmedText() {
  return z.preprocess((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    return value;
  }, z.string().trim().nullable());
}

export const recordFuelDeliverySchema = z.object({
  fuelTankId: z.string().uuid("Cuve invalide."),
  quantity: z.coerce
    .number()
    .positive("La quantité reçue doit être strictement positive."),
  supplierId: optionalNullableUuid("Fournisseur invalide.").optional(),
  purchasePricePerLiter: optionalNullablePositiveInt("Prix d'achat invalide."),
  totalCost: optionalNullablePositiveInt("Montant total invalide."),
  receivedOn: optionalNullableDate(),
  notes: optionalNullableTrimmedText(),
});

export const recordFuelLossSchema = z.object({
  fuelTankId: z.string().uuid("Cuve invalide."),
  quantity: z.coerce
    .number()
    .positive("La quantité perdue doit être strictement positive."),
  reason: z.string().trim().min(3, "Motif obligatoire (min. 3 caractères)."),
  lossDate: optionalNullableDate(),
});

export const recordFuelTankGaugeSchema = z.object({
  fuelTankId: z.string().uuid("Cuve invalide."),
  actualVolume: z.coerce
    .number()
    .min(0, "Volume réel invalide."),
  applyCorrection: z.preprocess((value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value === "true" || value === "on";
    return Boolean(value);
  }, z.boolean()),
  notes: optionalNullableTrimmedText(),
  gaugedOn: optionalNullableDate(),
});

export const recordStationCreditPaymentSchema = z.object({
  stationCreditId: z.string().uuid("Crédit invalide."),
  amount: z.coerce
    .number()
    .int()
    .positive("Montant paiement invalide."),
  method: paymentMethodSchema,
  notes: optionalNullableTrimmedText(),
});
