export type PumpForSelect = {
  id: string;
  name: string;
  fuelTypeName: string;
  fuelTankName: string;
  /** FCFA (integer) */
  pricePerLiter: number;
};

export type OwnOpenPumpSession = {
  id: string;
  openedAt: string;
  openedByName: string | null;

  fuelPumpId: string;
  fuelPumpName: string;

  fuelTypeName: string;
  fuelTankName: string;

  /** FCFA (integer) */
  pricePerLiter: number;

  /** Index de début (numeric(14,3)) */
  indexStart: number;

  isInitialSession: boolean;
  activeFuelLineId: string | null;
  sheetManual: Record<string, unknown> | null;
  sheetCarryForward: Record<string, unknown> | null;
};

export type StationSheetBootstrap = {
  isInitialSession: boolean;
  carryForward: Record<string, unknown> | null;
};

export type OtherOpenPumpSession = {
  fuelPumpId: string;
  openedAt: string;
  openedByName: string | null;
};

export type PumpSessionActionState = {
  error?: string;
  success?: string;
  sessionId?: string;
  /** Snapshot minimal pour afficher la fiche immédiatement après ouverture. */
  openedSession?: OwnOpenPumpSession;
};
