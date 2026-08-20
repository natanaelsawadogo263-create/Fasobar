"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import {
  useFasoBarCashier,
  type FasoBarCaisseFilters,
} from "@/components/fasobar/fasobar-cashier-context";

type FasoBarCaisseBridgeProps = FasoBarCaisseFilters & {
  onCloseSession?: () => void;
  onOpenOrders?: () => void;
  children: ReactNode;
};

/**
 * Publie les filtres caisse vers le shell FasoBar (sidebar / topbar hors de cet arbre).
 */
export function FasoBarCaisseBridge({
  children,
  onCloseSession,
  onOpenOrders,
  categories,
  departmentFilter,
  categoryId,
  search,
  searchInputRef,
  onDepartmentChange,
  onCategoryChange,
  onSearchChange,
  serviceScope,
  activityCode,
}: FasoBarCaisseBridgeProps) {
  const parent = useFasoBarCashier();
  const setCaisseFilters = parent?.setCaisseFilters;
  const setOnCloseSession = parent?.setOnCloseSession;
  const setOnOpenOrders = parent?.setOnOpenOrders;

  const onDepartmentChangeRef = useRef(onDepartmentChange);
  const onCategoryChangeRef = useRef(onCategoryChange);
  const onSearchChangeRef = useRef(onSearchChange);
  const onCloseSessionRef = useRef(onCloseSession);
  const onOpenOrdersRef = useRef(onOpenOrders);

  onDepartmentChangeRef.current = onDepartmentChange;
  onCategoryChangeRef.current = onCategoryChange;
  onSearchChangeRef.current = onSearchChange;
  onCloseSessionRef.current = onCloseSession;
  onOpenOrdersRef.current = onOpenOrders;

  useLayoutEffect(() => {
    if (!setCaisseFilters || !setOnCloseSession || !setOnOpenOrders) {
      return;
    }

    setCaisseFilters({
      categories,
      departmentFilter,
      categoryId,
      search,
      searchInputRef,
      onDepartmentChange: (filter) => onDepartmentChangeRef.current(filter),
      onCategoryChange: (id) => onCategoryChangeRef.current(id),
      onSearchChange: (value) => onSearchChangeRef.current(value),
      serviceScope,
      activityCode,
    });
    setOnCloseSession(() => onCloseSessionRef.current);
    setOnOpenOrders(() => onOpenOrdersRef.current);
  }, [
    setCaisseFilters,
    setOnCloseSession,
    setOnOpenOrders,
    categories,
    departmentFilter,
    categoryId,
    search,
    searchInputRef,
    serviceScope,
    activityCode,
  ]);

  useLayoutEffect(() => {
    return () => {
      setCaisseFilters?.(null);
      setOnCloseSession?.(undefined);
      setOnOpenOrders?.(undefined);
    };
  }, [setCaisseFilters, setOnCloseSession, setOnOpenOrders]);

  return children;
}
