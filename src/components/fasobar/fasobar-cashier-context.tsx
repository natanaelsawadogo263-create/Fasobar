"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CashierCategory } from "@/lib/orders/types";
import type { DepartmentFilter } from "@/components/pos/constants";
import { createClient } from "@/lib/supabase/client";

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
  establishmentId?: string;
  userId?: string;
  children: ReactNode;
};

export function FasoBarCashierProvider({
  establishmentName,
  cashierName,
  establishmentId,
  userId,
  children,
}: FasoBarCashierProviderProps) {
  const [hasSession, setHasSession] = useState(false);
  const [sessionOpenedAt, setSessionOpenedAt] = useState<string | undefined>();
  const [openOrdersCount, setOpenOrdersCount] = useState(0);
  const [readyToPayCount, setReadyToPayCount] = useState(0);
  const [caisseFilters, setCaisseFilters] = useState<FasoBarCaisseFilters | null>(null);
  const [onCloseSession, setOnCloseSessionState] = useState<(() => void) | undefined>();
  const [onOpenOrders, setOnOpenOrdersState] = useState<(() => void) | undefined>();

  const setOnCloseSession = useCallback((handler: (() => void) | undefined) => {
    setOnCloseSessionState(() => handler);
  }, []);

  const setOnOpenOrders = useCallback((handler: (() => void) | undefined) => {
    setOnOpenOrdersState(() => handler);
  }, []);

  useEffect(() => {
    if (!establishmentId) return;
    let cancelled = false;
    const supabase = createClient();

    async function loadMetrics() {
      const [sessionResult, ordersResult] = await Promise.all([
        userId
          ? supabase
              .from("cash_register_sessions")
              .select("opened_at")
              .eq("establishment_id", establishmentId)
              .eq("opened_by", userId)
              .eq("status", "OPEN")
              .maybeSingle()
          : Promise.resolve({ data: null as { opened_at: string } | null }),
        supabase
          .from("orders")
          .select("status")
          .eq("establishment_id", establishmentId)
          .in("status", ["OPEN", "READY_TO_PAY", "DRAFT"])
          .neq("payment_status", "PAID")
          .limit(200),
      ]);

      if (cancelled) return;

      setHasSession(Boolean(sessionResult.data));
      setSessionOpenedAt(sessionResult.data?.opened_at);
      const rows = ordersResult.data ?? [];
      setOpenOrdersCount(rows.length);
      setReadyToPayCount(rows.filter((row) => row.status === "READY_TO_PAY").length);
    }

    void loadMetrics();

    const channel = supabase
      .channel(`cashier-shell-metrics:${establishmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => {
          void loadMetrics();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cash_register_sessions",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => {
          void loadMetrics();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [establishmentId, userId]);

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
