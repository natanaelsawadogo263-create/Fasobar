"use client";

import { useLayoutEffect, type ReactNode } from "react";

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
}: FasoBarCaisseBridgeProps) {
  const parent = useFasoBarCashier();
  const setCaisseFilters = parent?.setCaisseFilters;
  const setOnCloseSession = parent?.setOnCloseSession;
  const setOnOpenOrders = parent?.setOnOpenOrders;

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
      onDepartmentChange,
      onCategoryChange,
      onSearchChange,
      serviceScope,
    });
    setOnCloseSession(onCloseSession);
    setOnOpenOrders(onOpenOrders);

    return () => {
      setCaisseFilters(null);
      setOnCloseSession(undefined);
      setOnOpenOrders(undefined);
    };
  }, [
    setCaisseFilters,
    setOnCloseSession,
    setOnOpenOrders,
    categories,
    departmentFilter,
    categoryId,
    search,
    searchInputRef,
    onDepartmentChange,
    onCategoryChange,
    onSearchChange,
    serviceScope,
    onCloseSession,
    onOpenOrders,
  ]);

  return children;
}
