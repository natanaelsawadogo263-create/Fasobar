export type FuelTypeItem = {
  id: string;
  name: string;
  selling_price: number;
  minimum_stock: number;
  active: boolean;
  sort_order: number;
};

export type FuelTankItem = {
  id: string;
  name: string;
  fuel_type_id: string;
  fuel_type_name: string;
  capacity: number;
  current_volume: number;
  minimum_volume: number;
  active: boolean;
};

export type FuelPumpItem = {
  id: string;
  name: string;
  fuel_type_id: string;
  fuel_type_name: string;
  fuel_tank_id: string;
  fuel_tank_name: string;
  current_index: number;
  active: boolean;
};

export type FuelTypeOption = {
  id: string;
  name: string;
};

export type FuelTankOption = {
  id: string;
  name: string;
};

export type FuelDeliveryItem = {
  id: string;
  receivedOn: string;
  supplierName: string | null;

  fuelTankId: string;
  fuelTankName: string;
  fuelTypeName: string;

  quantity: number;
  purchasePricePerLiter: number | null;
  totalCost: number | null;

  volumeBefore: number | null;
  volumeAfter: number | null;

  notes: string | null;
};

export type FuelLossItem = {
  id: string;
  lossDate: string;
  reason: string;

  fuelTankId: string;
  fuelTankName: string;
  fuelTypeName: string;

  quantity: number;
  notes: string | null;
};

export type FuelTankGaugeItem = {
  id: string;
  gaugedOn: string;

  fuelTankId: string;
  fuelTankName: string;

  theoreticalVolume: number;
  actualVolume: number;
  difference: number;

  notes: string | null;
  corrected: boolean;
};

export type StationCreditItem = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  liters: number | null;
  amount: number;
  amountPaid: number;
  status: "OPEN" | "PARTIAL" | "PAID" | "CANCELLED";
  creditDate: string;
  notes: string | null;
};

export type StationCreditPaymentItem = {
  id: string;
  stationCreditId: string;
  method: string;
  amount: number;
  receivedAt: string;
  receivedByName: string | null;
  notes: string | null;
};
