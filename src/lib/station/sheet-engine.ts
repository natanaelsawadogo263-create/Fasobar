/**
 * Moteur métier — fiche journalière Station Essence.
 * Toutes les formules vivent ici ; l'UI ne fait qu'afficher et saisir.
 */

export type StationFieldKind = "manual" | "carry_forward" | "calculated";

export type FuelLineId =
  | "SUPER_1"
  | "SUPER_2"
  | "SUPER_3"
  | "SUPER_4"
  | "SUPER_5"
  | "SUPER_6"
  | "GAZ_OIL_1"
  | "GAZ_OIL_2"
  | "GAZ_OIL_3"
  | "GAZ_OIL_4"
  | "GAZ_OIL_5";

export const FUEL_LINE_DEFS: ReadonlyArray<{ id: FuelLineId; label: string; kind: "SUPER" | "GAZ_OIL" }> = [
  { id: "SUPER_1", label: "SUPER 1", kind: "SUPER" },
  { id: "SUPER_2", label: "SUPER 2", kind: "SUPER" },
  { id: "SUPER_3", label: "SUPER 3", kind: "SUPER" },
  { id: "SUPER_4", label: "SUPER 4", kind: "SUPER" },
  { id: "SUPER_5", label: "SUPER 5", kind: "SUPER" },
  { id: "SUPER_6", label: "SUPER 6", kind: "SUPER" },
  { id: "GAZ_OIL_1", label: "GAZ OIL 1", kind: "GAZ_OIL" },
  { id: "GAZ_OIL_2", label: "GAZ OIL 2", kind: "GAZ_OIL" },
  { id: "GAZ_OIL_3", label: "GAZ OIL 3", kind: "GAZ_OIL" },
  { id: "GAZ_OIL_4", label: "GAZ OIL 4", kind: "GAZ_OIL" },
  { id: "GAZ_OIL_5", label: "GAZ OIL 5", kind: "GAZ_OIL" },
];

export const SHOP_ROW_COUNT = 6;

export type ShopLineManual = {
  designation: string;
  stockOuverture: number;
  quantiteRecue: number;
  btePu: number;
  puNet: number;
  venteJour: number;
};

export type AmountLineManual = {
  label: string;
  amount: number;
};

export type FuelLineManual = {
  stockRenterieur: number;
  stockOuverture: number;
  depotRempli: number;
  ventesJour: number;
  stockAjusteSortie: number;
  quantitePerdue: number;
  sortieStockSupplementaire: number;
  pu: number;
};

export type StationSheetManual = {
  fuelLines: Record<FuelLineId, FuelLineManual>;
  lubricants: ShopLineManual[];
  gas: ShopLineManual[];
  divers: ShopLineManual[];
  creditsAnterieurs: AmountLineManual[];
  creditsJour: AmountLineManual[];
  expenses: AmountLineManual[];
  defenses: AmountLineManual[];
  depensesSociales: number;
  ouagaBoust: number;
  poursuites: number;
  observations: string;
  recetteTotale: number;
  manquantsSaisis: number;
  surplusSaisis: number;
};

export type StationSheetCarryForward = {
  fuelLines: Partial<
    Record<
      FuelLineId,
      Pick<FuelLineManual, "stockRenterieur" | "stockOuverture" | "stockAjusteSortie">
    >
  >;
  lubricants: Pick<ShopLineManual, "stockOuverture">[];
  gas: Pick<ShopLineManual, "stockOuverture">[];
  divers: Pick<ShopLineManual, "stockOuverture">[];
  summaryReportVeille: {
    superLiters: number;
    gazoilLiters: number;
    totalCarburant: number;
    totalLubrifiants: number;
    totalGaz: number;
    totalDivers: number;
    totalGeneral: number;
  };
  monthlyFuelReceptionLiters: number;
  monthlyCaCumul: number;
};

export type StationSheetPrices = {
  superPu: number;
  gazoilPu: number;
};

/** Prix par défaut — le pompiste saisit les P.U. sur la fiche (pas de config admin). */
export const DEFAULT_SHEET_PRICES: StationSheetPrices = {
  superPu: 0,
  gazoilPu: 0,
};

export type StationSheetContext = {
  isInitialSession: boolean;
  /** Ligne liée à un compteur pompe (legacy). Null = fiche complète, saisie manuelle. */
  activeFuelLineId?: FuelLineId | null;
  /** Index compteur début (legacy, ligne active uniquement). */
  sessionIndexStart?: number;
  /** Index compteur fin (legacy, ligne active uniquement). */
  sessionIndexEnd?: number;
  carryForward: StationSheetCarryForward | null;
  prices: StationSheetPrices;
  manual: StationSheetManual;
};

export type ComputedFuelLine = {
  id: FuelLineId;
  label: string;
  pu: { value: number; kind: StationFieldKind; editable: boolean };
  stockRenterieur: { value: number; kind: StationFieldKind; editable: boolean };
  stockOuverture: { value: number; kind: StationFieldKind; editable: boolean };
  depotRempli: { value: number; kind: StationFieldKind; editable: boolean };
  ventesJour: { value: number; kind: StationFieldKind; editable: boolean };
  stockAjusteSortie: { value: number; kind: StationFieldKind; editable: boolean };
  quantitePerdue: { value: number; kind: StationFieldKind; editable: boolean };
  totalStock: { value: number; kind: StationFieldKind; editable: boolean };
  sortieStockSupplementaire: { value: number; kind: StationFieldKind; editable: boolean };
  stockDispoFinJour: { value: number; kind: StationFieldKind; editable: boolean };
  ecartStockFinJour: { value: number; kind: StationFieldKind; editable: boolean };
};

export type ComputedShopLine = {
  designation: { value: string; kind: StationFieldKind; editable: boolean };
  stockOuverture: { value: number; kind: StationFieldKind; editable: boolean };
  quantiteRecue: { value: number; kind: StationFieldKind; editable: boolean };
  stockTotal: { value: number; kind: StationFieldKind; editable: boolean };
  btePu: { value: number; kind: StationFieldKind; editable: boolean };
  puNet: { value: number; kind: StationFieldKind; editable: boolean };
  venteJour: { value: number; kind: StationFieldKind; editable: boolean };
  stockFinJour: { value: number; kind: StationFieldKind; editable: boolean };
  caLigne: { value: number; kind: StationFieldKind; editable: boolean };
};

export type ComputedAmountLine = {
  label: { value: string; kind: StationFieldKind; editable: boolean };
  amount: { value: number; kind: StationFieldKind; editable: boolean };
};

export type ComputedSummaryRow = {
  label: string;
  venteJour: { value: number; kind: StationFieldKind; editable: boolean };
  reportVeille: { value: number; kind: StationFieldKind; editable: boolean };
  totalMois: { value: number; kind: StationFieldKind; editable: boolean };
  caCumules: { value: number; kind: StationFieldKind; editable: boolean };
  unit: "L" | "FCFA";
};

export type ComputedStationSheet = {
  fuelLines: ComputedFuelLine[];
  receptionTotaleMoisLiters: { value: number; kind: StationFieldKind; editable: boolean };
  lubricants: ComputedShopLine[];
  venteTotaleLubrifiants: { value: number; kind: StationFieldKind; editable: boolean };
  gas: ComputedShopLine[];
  venteTotaleGaz: { value: number; kind: StationFieldKind; editable: boolean };
  divers: ComputedShopLine[];
  venteTotaleDivers: { value: number; kind: StationFieldKind; editable: boolean };
  summaryRows: ComputedSummaryRow[];
  creditsAnterieurs: ComputedAmountLine[];
  totalCreditsAnterieurs: { value: number; kind: StationFieldKind; editable: boolean };
  creditsJour: ComputedAmountLine[];
  totalCreditsJour: { value: number; kind: StationFieldKind; editable: boolean };
  expenses: ComputedAmountLine[];
  totalDepenses: { value: number; kind: StationFieldKind; editable: boolean };
  defenses: ComputedAmountLine[];
  totalDefenses: { value: number; kind: StationFieldKind; editable: boolean };
  manquants: { value: number; kind: StationFieldKind; editable: boolean };
  surplus: { value: number; kind: StationFieldKind; editable: boolean };
  totalManquantsSurplus: { value: number; kind: StationFieldKind; editable: boolean };
  cashControl: {
    recetteTotale: { value: number; kind: StationFieldKind; editable: boolean };
    encaissementCreditsAnterieurs: { value: number; kind: StationFieldKind; editable: boolean };
    depensesJour: { value: number; kind: StationFieldKind; editable: boolean };
    chiffreAffairesJour: { value: number; kind: StationFieldKind; editable: boolean };
    creditsJour: { value: number; kind: StationFieldKind; editable: boolean };
    depensesSociales: { value: number; kind: StationFieldKind; editable: boolean };
    ouagaBoust: { value: number; kind: StationFieldKind; editable: boolean };
    recetteNette: { value: number; kind: StationFieldKind; editable: boolean };
    manquantsSurplus: { value: number; kind: StationFieldKind; editable: boolean };
    poursuites: { value: number; kind: StationFieldKind; editable: boolean };
    versementNet: { value: number; kind: StationFieldKind; editable: boolean };
    observations: { value: string; kind: StationFieldKind; editable: boolean };
  };
  isIndexValid: boolean;
};

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function intCfa(value: unknown): number {
  return Math.max(0, Math.trunc(num(value)));
}

function liters3(value: unknown): number {
  return Math.round(num(value) * 1000) / 1000;
}

function calcTextField(
  value: string,
  kind: StationFieldKind,
  editable: boolean,
): { value: string; kind: StationFieldKind; editable: boolean } {
  return { value, kind, editable };
}

function calcNumField(
  value: number,
  kind: StationFieldKind,
  editable: boolean,
): { value: number; kind: StationFieldKind; editable: boolean } {
  return { value, kind, editable };
}

export function emptyShopLine(): ShopLineManual {
  return {
    designation: "",
    stockOuverture: 0,
    quantiteRecue: 0,
    btePu: 0,
    puNet: 0,
    venteJour: 0,
  };
}

export function emptyAmountLine(): AmountLineManual {
  return { label: "", amount: 0 };
}

export function emptyFuelLineManual(pu = 0): FuelLineManual {
  return {
    stockRenterieur: 0,
    stockOuverture: 0,
    depotRempli: 0,
    ventesJour: 0,
    stockAjusteSortie: 0,
    quantitePerdue: 0,
    sortieStockSupplementaire: 0,
    pu,
  };
}

export function createEmptyManual(prices: StationSheetPrices): StationSheetManual {
  const fuelLines = Object.fromEntries(
    FUEL_LINE_DEFS.map((def) => [
      def.id,
      emptyFuelLineManual(def.kind === "SUPER" ? prices.superPu : prices.gazoilPu),
    ]),
  ) as Record<FuelLineId, FuelLineManual>;

  return {
    fuelLines,
    lubricants: Array.from({ length: SHOP_ROW_COUNT }, emptyShopLine),
    gas: Array.from({ length: SHOP_ROW_COUNT }, emptyShopLine),
    divers: Array.from({ length: SHOP_ROW_COUNT }, emptyShopLine),
    creditsAnterieurs: Array.from({ length: 4 }, emptyAmountLine),
    creditsJour: Array.from({ length: 4 }, emptyAmountLine),
    expenses: [
      { label: "RESTE CAISSE", amount: 0 },
      { label: "GROS ENTRETIEN", amount: 0 },
      ...Array.from({ length: 3 }, emptyAmountLine),
    ],
    defenses: Array.from({ length: 4 }, emptyAmountLine),
    depensesSociales: 0,
    ouagaBoust: 0,
    poursuites: 0,
    observations: "",
    recetteTotale: 0,
    manquantsSaisis: 0,
    surplusSaisis: 0,
  };
}

export function emptyCarryForward(): StationSheetCarryForward {
  return {
    fuelLines: {},
    lubricants: Array.from({ length: SHOP_ROW_COUNT }, () => ({ stockOuverture: 0 })),
    gas: Array.from({ length: SHOP_ROW_COUNT }, () => ({ stockOuverture: 0 })),
    divers: Array.from({ length: SHOP_ROW_COUNT }, () => ({ stockOuverture: 0 })),
    summaryReportVeille: {
      superLiters: 0,
      gazoilLiters: 0,
      totalCarburant: 0,
      totalLubrifiants: 0,
      totalGaz: 0,
      totalDivers: 0,
      totalGeneral: 0,
    },
    monthlyFuelReceptionLiters: 0,
    monthlyCaCumul: 0,
  };
}

/** Déduit la ligne carburant à partir du nom pompe / carburant. */
export function resolveFuelLineId(fuelTypeName: string, fuelPumpName: string): FuelLineId {
  const type = fuelTypeName.toUpperCase();
  const pump = fuelPumpName.toUpperCase();
  const digitMatch = pump.match(/(\d+)/);
  const idx = digitMatch ? Math.min(6, Math.max(1, Number(digitMatch[1]))) : 1;

  if (type.includes("GO") || type.includes("GAZOIL") || type.includes("GASOIL") || type.includes("DIESEL")) {
    const gazIdx = Math.min(5, idx);
    return `GAZ_OIL_${gazIdx}` as FuelLineId;
  }

  return `SUPER_${idx}` as FuelLineId;
}

function computeShopSection(
  lines: ShopLineManual[],
  carryOpens: Array<{ stockOuverture: number }>,
  isInitialSession: boolean,
): { rows: ComputedShopLine[]; venteTotale: number } {
  let venteTotale = 0;
  const rows = lines.map((line, index) => {
    const carryOpen = carryOpens[index]?.stockOuverture ?? 0;
    const stockOuvertureEditable = isInitialSession;
    const stockOuverture = stockOuvertureEditable
      ? liters3(line.stockOuverture)
      : liters3(carryOpen || line.stockOuverture);

    const quantiteRecue = liters3(line.quantiteRecue);
    const stockTotal = liters3(stockOuverture + quantiteRecue);
    const venteJour = liters3(line.venteJour);
    const stockFinJour = liters3(stockTotal - venteJour);
    const puNet = intCfa(line.puNet);
    const caLigne = Math.round(venteJour * puNet);
    venteTotale += caLigne;

    return {
      designation: calcTextField(line.designation, "manual", true),
      stockOuverture: calcNumField(
        stockOuverture,
        stockOuvertureEditable ? "manual" : "carry_forward",
        stockOuvertureEditable,
      ),
      quantiteRecue: calcNumField(quantiteRecue, "manual", true),
      stockTotal: calcNumField(stockTotal, "calculated", false),
      btePu: calcNumField(intCfa(line.btePu), "manual", true),
      puNet: calcNumField(puNet, "manual", true),
      venteJour: calcNumField(venteJour, "manual", true),
      stockFinJour: calcNumField(stockFinJour, "calculated", false),
      caLigne: calcNumField(caLigne, "calculated", false),
    };
  });

  return { rows, venteTotale };
}

function computeAmountLines(lines: AmountLineManual[]): {
  rows: ComputedAmountLine[];
  total: number;
} {
  let total = 0;
  const rows = lines.map((line) => {
    const amount = intCfa(line.amount);
    total += amount;
    return {
      label: calcTextField(line.label, "manual", true),
      amount: calcNumField(amount, "manual", true),
    };
  });
  return { rows, total };
}

/**
 * Calcule l'intégralité de la fiche à partir du contexte (manuel + reprise + session).
 */
export function computeStationSheet(ctx: StationSheetContext): ComputedStationSheet {
  const carry = ctx.carryForward ?? emptyCarryForward();
  const sessionIndexStart = ctx.sessionIndexStart ?? 0;
  const sessionIndexEnd = ctx.sessionIndexEnd ?? 0;
  const isActive = (id: FuelLineId) =>
    ctx.activeFuelLineId != null && id === ctx.activeFuelLineId;

  let superLiters = 0;
  let gazoilLiters = 0;
  let fuelCaJour = 0;
  let depotJourTotal = 0;

  const fuelLines: ComputedFuelLine[] = FUEL_LINE_DEFS.map((def) => {
    const manual = ctx.manual.fuelLines[def.id] ?? emptyFuelLineManual();
    const carried = carry.fuelLines[def.id];
    const active = isActive(def.id);

    const defaultPu = def.kind === "SUPER" ? ctx.prices.superPu : ctx.prices.gazoilPu;
    const pu = intCfa(manual.pu || defaultPu);

    const stockCfEditable = ctx.isInitialSession;
    const stockRenterieur = stockCfEditable
      ? liters3(manual.stockRenterieur)
      : liters3(
          carried?.stockRenterieur ??
            manual.stockRenterieur ??
            (active ? sessionIndexStart : 0),
        );
    const stockOuverture = stockCfEditable
      ? liters3(manual.stockOuverture)
      : liters3(
          carried?.stockOuverture ??
            manual.stockOuverture ??
            stockRenterieur ??
            (active ? sessionIndexStart : 0),
        );

    const depotRempli = liters3(manual.depotRempli);
    depotJourTotal += depotRempli;

    let ventesJour = liters3(manual.ventesJour);
    if (active) {
      const diffMilli =
        Math.round(sessionIndexEnd * 1000) - Math.round(sessionIndexStart * 1000);
      ventesJour = diffMilli >= 0 ? diffMilli / 1000 : 0;
    }

    let stockAjusteSortie = liters3(manual.stockAjusteSortie);
    if (active) {
      stockAjusteSortie = liters3(sessionIndexEnd);
    } else if (!ctx.isInitialSession && carried?.stockAjusteSortie != null) {
      stockAjusteSortie = liters3(carried.stockAjusteSortie);
    }

    const quantitePerdue = liters3(manual.quantitePerdue);
    const totalStock = liters3(stockOuverture + depotRempli - ventesJour - quantitePerdue);
    const sortieStockSupplementaire = liters3(manual.sortieStockSupplementaire);
    const stockDispoFinJour = liters3(totalStock - sortieStockSupplementaire);
    const ecartStockFinJour = liters3(stockAjusteSortie - stockDispoFinJour);

    if (def.kind === "SUPER") superLiters += ventesJour;
    else gazoilLiters += ventesJour;
    fuelCaJour += Math.round(ventesJour * pu);

    return {
      id: def.id,
      label: def.label,
      pu: calcNumField(pu, active ? "carry_forward" : "manual", !active && ctx.isInitialSession),
      stockRenterieur: calcNumField(
        stockRenterieur,
        stockCfEditable ? "manual" : "carry_forward",
        stockCfEditable,
      ),
      stockOuverture: calcNumField(
        stockOuverture,
        stockCfEditable ? "manual" : "carry_forward",
        stockCfEditable,
      ),
      depotRempli: calcNumField(depotRempli, "manual", true),
      ventesJour: calcNumField(
        ventesJour,
        active ? "calculated" : "manual",
        !active,
      ),
      stockAjusteSortie: calcNumField(
        stockAjusteSortie,
        active ? "manual" : ctx.isInitialSession ? "manual" : "carry_forward",
        active || ctx.isInitialSession,
      ),
      quantitePerdue: calcNumField(quantitePerdue, "manual", true),
      totalStock: calcNumField(totalStock, "calculated", false),
      sortieStockSupplementaire: calcNumField(sortieStockSupplementaire, "manual", true),
      stockDispoFinJour: calcNumField(stockDispoFinJour, "calculated", false),
      ecartStockFinJour: calcNumField(ecartStockFinJour, "calculated", false),
    };
  });

  const receptionTotaleMoisLiters = liters3(
    carry.monthlyFuelReceptionLiters + depotJourTotal,
  );

  const lubSection = computeShopSection(
    ctx.manual.lubricants,
    carry.lubricants,
    ctx.isInitialSession,
  );
  const gasSection = computeShopSection(ctx.manual.gas, carry.gas, ctx.isInitialSession);
  const diversSection = computeShopSection(ctx.manual.divers, carry.divers, ctx.isInitialSession);

  const totalCarburantLiters = liters3(superLiters + gazoilLiters);
  const totalGeneralCa =
    fuelCaJour + lubSection.venteTotale + gasSection.venteTotale + diversSection.venteTotale;

  const reportVeille = intCfa(carry.summaryReportVeille.totalGeneral);
  const totalMois = intCfa(reportVeille + totalGeneralCa);
  const caCumules = intCfa(carry.monthlyCaCumul + totalGeneralCa);

  const creditsAnt = computeAmountLines(ctx.manual.creditsAnterieurs);
  const creditsJour = computeAmountLines(ctx.manual.creditsJour);
  const expenses = computeAmountLines(ctx.manual.expenses);
  const defenses = computeAmountLines(ctx.manual.defenses);
  const totalDepensesEtDefenses = expenses.total + defenses.total;

  const recetteTotale = intCfa(ctx.manual.recetteTotale);
  const depensesSociales = intCfa(ctx.manual.depensesSociales);
  const ouagaBoust = intCfa(ctx.manual.ouagaBoust);
  const poursuites = intCfa(ctx.manual.poursuites);

  const rv = carry.summaryReportVeille;
  const summaryRows: ComputedSummaryRow[] = [
    {
      label: "SUPER (LITRES)",
      venteJour: calcNumField(superLiters, "calculated", false),
      reportVeille: calcNumField(rv.superLiters, "carry_forward", false),
      totalMois: calcNumField(rv.superLiters + superLiters, "calculated", false),
      caCumules: calcNumField(rv.superLiters + superLiters, "calculated", false),
      unit: "L",
    },
    {
      label: "GAZOIL (LITRES)",
      venteJour: calcNumField(gazoilLiters, "calculated", false),
      reportVeille: calcNumField(rv.gazoilLiters, "carry_forward", false),
      totalMois: calcNumField(rv.gazoilLiters + gazoilLiters, "calculated", false),
      caCumules: calcNumField(rv.gazoilLiters + gazoilLiters, "calculated", false),
      unit: "L",
    },
    {
      label: "TOTAL CARBURANT",
      venteJour: calcNumField(fuelCaJour, "calculated", false),
      reportVeille: calcNumField(rv.totalCarburant, "carry_forward", false),
      totalMois: calcNumField(rv.totalCarburant + fuelCaJour, "calculated", false),
      caCumules: calcNumField(carry.monthlyCaCumul + fuelCaJour, "calculated", false),
      unit: "FCFA",
    },
    {
      label: "TOTAL LUBRIFIANTS",
      venteJour: calcNumField(lubSection.venteTotale, "calculated", false),
      reportVeille: calcNumField(rv.totalLubrifiants, "carry_forward", false),
      totalMois: calcNumField(rv.totalLubrifiants + lubSection.venteTotale, "calculated", false),
      caCumules: calcNumField(rv.totalLubrifiants + lubSection.venteTotale, "calculated", false),
      unit: "FCFA",
    },
    {
      label: "TOTAL GAZ",
      venteJour: calcNumField(gasSection.venteTotale, "calculated", false),
      reportVeille: calcNumField(rv.totalGaz, "carry_forward", false),
      totalMois: calcNumField(rv.totalGaz + gasSection.venteTotale, "calculated", false),
      caCumules: calcNumField(rv.totalGaz + gasSection.venteTotale, "calculated", false),
      unit: "FCFA",
    },
    {
      label: "TOTAL DIVERS",
      venteJour: calcNumField(diversSection.venteTotale, "calculated", false),
      reportVeille: calcNumField(rv.totalDivers, "carry_forward", false),
      totalMois: calcNumField(rv.totalDivers + diversSection.venteTotale, "calculated", false),
      caCumules: calcNumField(rv.totalDivers + diversSection.venteTotale, "calculated", false),
      unit: "FCFA",
    },
    {
      label: "TOTAL GENERAL",
      venteJour: calcNumField(totalGeneralCa, "calculated", false),
      reportVeille: calcNumField(reportVeille, "carry_forward", false),
      totalMois: calcNumField(totalMois, "calculated", false),
      caCumules: calcNumField(caCumules, "calculated", false),
      unit: "FCFA",
    },
  ];

  const cashDifference = recetteTotale + creditsJour.total - fuelCaJour;
  const manquants = intCfa(ctx.manual.manquantsSaisis);
  const surplus = intCfa(ctx.manual.surplusSaisis);

  const recetteNette = intCfa(
    recetteTotale +
      creditsAnt.total -
      totalDepensesEtDefenses -
      creditsJour.total -
      depensesSociales -
      ouagaBoust,
  );
  const versementNet = intCfa(recetteNette - manquants + surplus - poursuites);

  const indexValid =
    ctx.activeFuelLineId == null ||
    Math.round(sessionIndexEnd * 1000) >= Math.round(sessionIndexStart * 1000);

  return {
    fuelLines,
    receptionTotaleMoisLiters: calcNumField(receptionTotaleMoisLiters, "calculated", false),
    lubricants: lubSection.rows,
    venteTotaleLubrifiants: calcNumField(lubSection.venteTotale, "calculated", false),
    gas: gasSection.rows,
    venteTotaleGaz: calcNumField(gasSection.venteTotale, "calculated", false),
    divers: diversSection.rows,
    venteTotaleDivers: calcNumField(diversSection.venteTotale, "calculated", false),
    summaryRows,
    creditsAnterieurs: creditsAnt.rows,
    totalCreditsAnterieurs: calcNumField(creditsAnt.total, "calculated", false),
    creditsJour: creditsJour.rows,
    totalCreditsJour: calcNumField(creditsJour.total, "calculated", false),
    expenses: expenses.rows,
    totalDepenses: calcNumField(expenses.total, "calculated", false),
    defenses: defenses.rows,
    totalDefenses: calcNumField(defenses.total, "calculated", false),
    manquants: calcNumField(manquants, "manual", true),
    surplus: calcNumField(surplus, "manual", true),
    totalManquantsSurplus: calcNumField(manquants - surplus, "calculated", false),
    cashControl: {
      recetteTotale: calcNumField(recetteTotale, "manual", true),
      encaissementCreditsAnterieurs: calcNumField(creditsAnt.total, "calculated", false),
      depensesJour: calcNumField(totalDepensesEtDefenses, "calculated", false),
      chiffreAffairesJour: calcNumField(fuelCaJour, "calculated", false),
      creditsJour: calcNumField(creditsJour.total, "calculated", false),
      depensesSociales: calcNumField(depensesSociales, "manual", true),
      ouagaBoust: calcNumField(ouagaBoust, "manual", true),
      recetteNette: calcNumField(recetteNette, "calculated", false),
      manquantsSurplus: calcNumField(cashDifference, "calculated", false),
      poursuites: calcNumField(poursuites, "manual", true),
      versementNet: calcNumField(versementNet, "calculated", false),
      observations: calcTextField(ctx.manual.observations, "manual", true),
    },
    isIndexValid: indexValid,
  };
}

export type SheetManualPath =
  | { section: "fuel"; lineId: FuelLineId; field: keyof FuelLineManual }
  | { section: "lubricants" | "gas" | "divers"; index: number; field: keyof ShopLineManual }
  | {
      section: "creditsAnterieurs" | "creditsJour" | "expenses" | "defenses";
      index: number;
      field: keyof AmountLineManual;
    }
  | {
      section: "root";
      field:
        | "recetteTotale"
        | "depensesSociales"
        | "ouagaBoust"
        | "poursuites"
        | "observations"
        | "manquantsSaisis"
        | "surplusSaisis";
    };

export function applySheetManualChange(
  manual: StationSheetManual,
  path: SheetManualPath,
  value: number | string,
): StationSheetManual {
  const next: StationSheetManual = structuredClone(manual);

  if (path.section === "fuel") {
    const line = next.fuelLines[path.lineId];
    if (!line) return manual;
    const numericFields: Array<keyof FuelLineManual> = [
      "stockRenterieur",
      "stockOuverture",
      "depotRempli",
      "ventesJour",
      "stockAjusteSortie",
      "quantitePerdue",
      "sortieStockSupplementaire",
      "pu",
    ];
    if (numericFields.includes(path.field)) {
      line[path.field] = typeof value === "number" ? value : Number(value) || 0;
    }
    return next;
  }

  if (path.section === "root") {
    if (path.field === "observations") {
      next.observations = String(value);
    } else if (path.field === "recetteTotale") {
      next.recetteTotale = typeof value === "number" ? value : Number(value) || 0;
    } else if (path.field === "depensesSociales") {
      next.depensesSociales = typeof value === "number" ? value : Number(value) || 0;
    } else if (path.field === "ouagaBoust") {
      next.ouagaBoust = typeof value === "number" ? value : Number(value) || 0;
    } else if (path.field === "poursuites") {
      next.poursuites = typeof value === "number" ? value : Number(value) || 0;
    } else if (path.field === "manquantsSaisis") {
      next.manquantsSaisis = typeof value === "number" ? value : Number(value) || 0;
    } else if (path.field === "surplusSaisis") {
      next.surplusSaisis = typeof value === "number" ? value : Number(value) || 0;
    }
    return next;
  }

  const collection = next[path.section] as Array<Record<string, number | string>>;
  const row = collection[path.index];
  if (!row) return manual;
  row[path.field] = path.field === "label" ? String(value) : Number(value) || 0;
  return next;
}

export function parseSheetManual(
  raw: Record<string, unknown> | null | undefined,
  prices: StationSheetPrices,
): StationSheetManual {
  const empty = createEmptyManual(prices);
  if (!raw || typeof raw !== "object") return empty;

  try {
    const parsed = raw as Partial<StationSheetManual>;
    return {
      ...empty,
      ...parsed,
      fuelLines: { ...empty.fuelLines, ...(parsed.fuelLines ?? {}) },
      lubricants: parsed.lubricants?.length ? parsed.lubricants : empty.lubricants,
      gas: parsed.gas?.length ? parsed.gas : empty.gas,
      divers: parsed.divers?.length ? parsed.divers : empty.divers,
      creditsAnterieurs: parsed.creditsAnterieurs?.length
        ? parsed.creditsAnterieurs
        : empty.creditsAnterieurs,
      creditsJour: parsed.creditsJour?.length ? parsed.creditsJour : empty.creditsJour,
      expenses: parsed.expenses?.length ? parsed.expenses : empty.expenses,
      defenses: parsed.defenses?.length ? parsed.defenses : empty.defenses,
    };
  } catch {
    return empty;
  }
}

export function parseSheetCarryForward(
  raw: Record<string, unknown> | null | undefined,
): StationSheetCarryForward | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    return raw as StationSheetCarryForward;
  } catch {
    return null;
  }
}

export function buildCarryForwardForNextSession(
  computed: ComputedStationSheet,
  previousCarry: StationSheetCarryForward | null,
): StationSheetCarryForward {
  const prev = previousCarry ?? emptyCarryForward();
  const fuelLines: StationSheetCarryForward["fuelLines"] = {};

  for (const row of computed.fuelLines) {
    fuelLines[row.id] = {
      stockRenterieur: num(row.stockAjusteSortie.value),
      stockOuverture: num(row.stockDispoFinJour.value),
      stockAjusteSortie: num(row.stockAjusteSortie.value),
    };
  }

  const superRow = computed.summaryRows[0];
  const gazRow = computed.summaryRows[1];
  const totalRow = computed.summaryRows[6];

  return {
    fuelLines,
    lubricants: computed.lubricants.map((row) => ({
      stockOuverture: num(row.stockFinJour.value),
    })),
    gas: computed.gas.map((row) => ({ stockOuverture: num(row.stockFinJour.value) })),
    divers: computed.divers.map((row) => ({
      stockOuverture: num(row.stockFinJour.value),
    })),
    summaryReportVeille: {
      superLiters: num(prev.summaryReportVeille.superLiters) + num(superRow?.venteJour.value),
      gazoilLiters: num(prev.summaryReportVeille.gazoilLiters) + num(gazRow?.venteJour.value),
      totalCarburant:
        num(prev.summaryReportVeille.totalCarburant) +
        num(computed.summaryRows[2]?.venteJour.value),
      totalLubrifiants:
        num(prev.summaryReportVeille.totalLubrifiants) +
        num(computed.summaryRows[3]?.venteJour.value),
      totalGaz:
        num(prev.summaryReportVeille.totalGaz) + num(computed.summaryRows[4]?.venteJour.value),
      totalDivers:
        num(prev.summaryReportVeille.totalDivers) +
        num(computed.summaryRows[5]?.venteJour.value),
      totalGeneral:
        num(prev.summaryReportVeille.totalGeneral) + num(totalRow?.venteJour.value),
    },
    monthlyFuelReceptionLiters: num(computed.receptionTotaleMoisLiters.value),
    monthlyCaCumul: num(totalRow?.caCumules.value),
  };
}

/** Compatibilité session pompe simplifiée (clôture). */
export function computeStationSessionSheet(input: {
  indexStart: number;
  indexEnd: number;
  pricePerLiter: number;
  totalCollected: number;
  creditAmount: number;
}): {
  litersSold: number;
  theoreticalAmount: number;
  totalDeclared: number;
  difference: number;
  isIndexValid: boolean;
} {
  const manual = createEmptyManual({ superPu: input.pricePerLiter, gazoilPu: input.pricePerLiter });
  const activeId = "SUPER_1";
  manual.recetteTotale = input.totalCollected;
  manual.creditsJour[0] = { label: "Crédit session", amount: input.creditAmount };

  const computed = computeStationSheet({
    isInitialSession: false,
    activeFuelLineId: activeId,
    sessionIndexStart: input.indexStart,
    sessionIndexEnd: input.indexEnd,
    carryForward: null,
    prices: { superPu: input.pricePerLiter, gazoilPu: input.pricePerLiter },
    manual,
  });

  const active = computed.fuelLines.find((r) => r.id === activeId)!;
  return {
    litersSold: num(active.ventesJour.value),
    theoreticalAmount: intCfa(num(active.ventesJour.value) * input.pricePerLiter),
    totalDeclared: intCfa(input.totalCollected),
    difference: num(computed.cashControl.manquantsSurplus.value),
    isIndexValid: computed.isIndexValid,
  };
}
