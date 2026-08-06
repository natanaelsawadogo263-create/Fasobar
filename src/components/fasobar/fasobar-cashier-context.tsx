"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CashierCategory } from "@/lib/orders/types";
import type { DepartmentFilter } from "@/components/pos/constants";

export type FasoBarCaisseFilters = {
  categories: CashierCategory[];
  departmentFilter: DepartmentFilter;
  categoryId: string;
  search: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onDepartmentChange: (filter: DepartmentFilter) => void;
  onCategoryChange: (categoryId: string) => void;
  onSearchChange: (value: string) => void;
};

type FasoBarCashierContextValue = {
  establishmentName: string;
  cashierName: string;
  hasSession: boolean;
  sessionOpenedAt?: string;
  openOrdersCount: number;
  readyToPayCount: number;
  caisseFilters: FasoBarCaisseFilters | null;
  onCloseSession?: () => void;
  onOpenOrders?: () => void;
  setCaisseFilters: (filters: FasoBarCaisseFilters | null) => void;
  setOnCloseSession: (handler: (() => void) | undefined) => void;
  setOnOpenOrders: (handler: (() => void) | undefined) => void;
};

const FasoBarCashierContext = createContext<FasoBarCashierContextValue | null>(null);

type FasoBarCashierProviderProps = {
  establishmentName: string;
  cashierName: string;
  hasSession: boolean;
  sessionOpenedAt?: string;
  openOrdersCount: number;
  readyToPayCount: number;
  children: ReactNode;
};

export function FasoBarCashierProvider({
  establishmentName,
  cashierName,
  hasSession,
  sessionOpenedAt,
  openOrdersCount,
  readyToPayCount,
  children,
}: FasoBarCashierProviderProps) {
  const [caisseFilters, setCaisseFilters] = useState<FasoBarCaisseFilters | null>(null);
  const [onCloseSession, setOnCloseSessionState] = useState<(() => void) | undefined>();
  const [onOpenOrders, setOnOpenOrdersState] = useState<(() => void) | undefined>();

  const setOnCloseSession = useCallback((handler: (() => void) | undefined) => {
    setOnCloseSessionState(() => handler);
  }, []);

  const setOnOpenOrders = useCallback((handler: (() => void) | undefined) => {
    setOnOpenOrdersState(() => handler);
  }, []);

  const value = useMemo(
    () => ({
      establishmentName,
      cashierName,
      hasSession,
      sessionOpenedAt,
      openOrdersCount,
      readyToPayCount,
      caisseFilters,
      onCloseSession,
      onOpenOrders,
      setCaisseFilters,
      setOnCloseSession,
      setOnOpenOrders,
    }),
    [
      establishmentName,
      cashierName,
      hasSession,
      sessionOpenedAt,
      openOrdersCount,
      readyToPayCount,
      caisseFilters,
      onCloseSession,
      onOpenOrders,
      setOnCloseSession,
      setOnOpenOrders,
    ],
  );

  return (
    <FasoBarCashierContext.Provider value={value}>{children}</FasoBarCashierContext.Provider>
  );
}

export function useFasoBarCashier() {
  return useContext(FasoBarCashierContext);
}
