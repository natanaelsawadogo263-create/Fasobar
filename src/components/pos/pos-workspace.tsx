"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, ShoppingBag } from "lucide-react";

import { saveOrderAction } from "@/app/(protected)/application/caisse/actions";
import {
  openCashSessionAction,
  quickCashCheckoutAction,
} from "@/app/(protected)/application/caisse/payment-actions";
import { FasoBarCaisseBridge } from "@/components/fasobar/fasobar-caisse-bridge";
import { useFasoBarCashier } from "@/components/fasobar/fasobar-cashier-context";
import { ActiveOrderPanel } from "@/components/pos/active-order-panel";
import { OpenOrdersDrawer } from "@/components/pos/open-orders-drawer";
import { PosToast } from "@/components/pos/pos-toast";
import { ProductGrid } from "@/components/pos/product-grid";
import type { DepartmentFilter } from "@/components/pos/constants";
import { usePosKeyboard } from "@/components/pos/use-pos-keyboard";
import {
  CashCheckoutModal,
  type CashCheckoutSuccess,
} from "@/components/payments/cash-checkout-modal";
import { CloseSessionModal } from "@/components/payments/close-session-modal";
import { OpenSessionModal } from "@/components/payments/open-session-modal";
import { formatPriceXof } from "@/lib/orders/constants";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { CAISSE_CATEGORIES } from "@/lib/caisse/catalog";
import {
  buildDemoCart,
  getDemoTableReference,
  shouldUseDemoCart,
} from "@/lib/caisse/demo-cart";
import { sortCaisseProducts } from "@/lib/caisse/sort-products";
import { isProductOutOfStock } from "@/lib/orders/stock-availability";
import type {
  CartLine,
  CashierCategory,
  CashierProduct,
  OpenOrderListItem,
  OrderDetail,
} from "@/lib/orders/types";
import type { OrderType } from "@/lib/orders/schemas";
import type { CashSessionDetail } from "@/lib/payments/types";
import { getActivityPages } from "@/lib/activity/pages";
import { getActivityProfile } from "@/lib/activity/profile";
import {
  defaultPosDepartmentFilter,
  type ServiceScope,
} from "@/lib/settings/service-scope";

type PosWorkspaceProps = {
  cashierName: string;
  categories: CashierCategory[];
  products: CashierProduct[];
  openOrders: OpenOrderListItem[];
  session: CashSessionDetail | null;
  initialOrder?: OrderDetail | null;
  /** Panier vide (pas de panier démo). */
  freshCart?: boolean;
  serviceScope?: ServiceScope;
  activityCode?: string | null;
};

type MobileTab = "products" | "order";

type ToastTone = "success" | "error" | "info";

type ToastState = {
  message: string;
  tone: ToastTone;
} | null;

type CheckoutDraft = {
  source: "cart" | "saved";
  /** Commande déjà connue (panier repris ou tiroirs). */
  existingOrderId?: string;
  totalToPay: number;
  orderNumber?: number;
};

function buildCartFromOrder(order: OrderDetail): CartLine[] {
  return order.items.map((item) => ({
    productId: item.productId,
    name: item.productName,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    departmentCode: item.departmentCode,
    departmentName: item.departmentName,
    unit: "",
    notes: item.notes ?? undefined,
    available: true,
  }));
}

function getCategoryTitle(
  categoryId: string,
  departmentFilter: DepartmentFilter,
  categories: CashierCategory[],
  allProductsLabel: string,
  retail: boolean,
): string {
  if (categoryId !== "all") {
    const fromDb = categories.find((category) => category.id === categoryId);
    if (fromDb) {
      return fromDb.name;
    }
    return CAISSE_CATEGORIES.find((category) => category.slug === categoryId)?.name ?? "Catégorie";
  }
  if (!retail && departmentFilter === "bar") return "Boissons";
  if (!retail && departmentFilter === "kitchen") return "Cuisine";
  return allProductsLabel;
}

function resolveCategoryName(
  categoryId: string,
  categories: CashierCategory[],
): string | null {
  if (categoryId === "all") {
    return null;
  }

  const fromDb = categories.find((category) => category.id === categoryId);
  if (fromDb) {
    return fromDb.name;
  }

  return CAISSE_CATEGORIES.find((category) => category.slug === categoryId)?.name ?? null;
}

export function PosWorkspace({
  cashierName,
  categories,
  products,
  openOrders,
  session,
  initialOrder,
  freshCart = false,
  serviceScope = "BOTH",
  activityCode = null,
}: PosWorkspaceProps) {
  const profile = getActivityProfile(activityCode);
  const pages = getActivityPages(activityCode);
  const retail = profile.kind === "retail";
  const router = useRouter();
  const cashierCtx = useFasoBarCashier();
  const browseWithoutSession = Boolean(cashierCtx?.adminReturnHref);
  // Tous les produits actifs de l'établissement (créés par l'admin) — pas le catalogue démo.
  const catalogProducts = useMemo(() => {
    const sorted = sortCaisseProducts(products);
    if (serviceScope === "BAR") {
      return sorted.filter((product) => product.departmentCode === "BAR");
    }
    if (serviceScope === "KITCHEN") {
      return sorted.filter((product) => product.departmentCode === "KITCHEN");
    }
    return sorted;
  }, [products, serviceScope]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isOpening, startOpenTransition] = useTransition();
  const [toast, setToast] = useState<ToastState>(null);
  const [openError, setOpenError] = useState<string | undefined>();
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showOpenOrders, setShowOpenOrders] = useState(false);
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<CashCheckoutSuccess | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("products");
  const [flashProductId, setFlashProductId] = useState<string | null>(null);

  const [orderId, setOrderId] = useState(initialOrder?.id ?? "");
  const [discountAmount] = useState(initialOrder?.discountAmount ?? 0);
  const [tableReference, setTableReference] = useState(() => {
    if (initialOrder?.tableReference || initialOrder?.customerReference) {
      return initialOrder.tableReference ?? initialOrder.customerReference ?? "";
    }
    if (!freshCart && shouldUseDemoCart(initialOrder)) {
      return getDemoTableReference();
    }
    return "";
  });
  const [orderType, setOrderType] = useState<OrderType>(
    initialOrder?.orderType ?? (retail ? "TAKEAWAY" : "ON_SITE"),
  );
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilter>(
    defaultPosDepartmentFilter(serviceScope),
  );
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>(() => {
    if (initialOrder) {
      return buildCartFromOrder(initialOrder);
    }
    if (!freshCart && shouldUseDemoCart(initialOrder)) {
      return buildDemoCart(catalogProducts);
    }
    return [];
  });

  const filteredProducts = useMemo(() => {
    const categoryName = resolveCategoryName(categoryId, categories);

    return catalogProducts.filter((product) => {
      if (departmentFilter === "bar" && product.departmentCode !== "BAR") return false;
      if (departmentFilter === "kitchen" && product.departmentCode !== "KITCHEN") return false;
      if (categoryName && product.categoryName.toLowerCase() !== categoryName.toLowerCase()) {
        return false;
      }
      if (categoryId !== "all" && !categoryName && product.categoryId !== categoryId) {
        return false;
      }
      if (search && !product.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [catalogProducts, departmentFilter, categoryId, categories, search]);

  const subtotal = cart.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
  const totalAmount = Math.max(subtotal - discountAmount, 0);
  const categoryTitle = getCategoryTitle(
    categoryId,
    departmentFilter,
    categories,
    pages.pos.allProducts,
    retail,
  );
  const totalProductCount = products.length;

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const handleCloseSession = useCallback(() => {
    setShowCloseModal(true);
  }, []);

  const handleOpenOrdersDrawer = useCallback(() => {
    setShowOpenOrders(true);
  }, []);

  const handleDepartmentChange = useCallback((filter: DepartmentFilter) => {
    setDepartmentFilter(filter);
  }, []);

  const handleCategoryChange = useCallback((nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  function addProduct(product: CashierProduct) {
    if (isProductOutOfStock(product)) {
      return;
    }
    setFlashProductId(product.id);
    window.setTimeout(() => setFlashProductId(null), 180);

    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.sellingPrice,
          quantity: 1,
          departmentCode: product.departmentCode,
          departmentName: product.departmentName,
          categoryName: product.categoryName,
          unit: product.unit,
          available: true,
        },
      ];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((current) => current.filter((line) => line.productId !== productId));
      return;
    }
    setCart((current) =>
      current.map((line) => (line.productId === productId ? { ...line, quantity } : line)),
    );
  }

  function updateNotes(productId: string, notes: string) {
    setCart((current) =>
      current.map((line) => (line.productId === productId ? { ...line, notes } : line)),
    );
  }

  function removeLine(productId: string) {
    setCart((current) => current.filter((line) => line.productId !== productId));
  }

  function clearCart() {
    setCart([]);
    setOrderId("");
    setTableReference("");
  }

  function buildFormData(targetStatus: "OPEN" | "DRAFT" | "READY_TO_PAY") {
    const formData = new FormData();
    if (orderId) formData.set("orderId", orderId);
    formData.set("tableReference", tableReference);
    formData.set("customerReference", tableReference);
    formData.set("orderType", orderType);
    formData.set("targetStatus", targetStatus);
    formData.set(
      "items",
      JSON.stringify(
        cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          notes: line.notes,
        })),
      ),
    );
    return formData;
  }

  function startFreshOrder(options?: { toast?: string; remount?: boolean }) {
    clearCart();
    setOrderType(retail ? "TAKEAWAY" : "ON_SITE");
    setMobileTab("products");
    if (options?.toast) {
      showToast(options.toast, "success");
    }
    if (options?.remount) {
      router.replace(`/application/caisse?fresh=1&t=${Date.now()}`);
      return;
    }
    refreshSoon(() => router.refresh());
  }

  function submitOrder(
    targetStatus: "OPEN" | "DRAFT" | "READY_TO_PAY",
    onSuccess?: (savedOrderId: string) => void | Promise<void>,
    onError?: () => void,
  ) {
    if (cart.length === 0) {
      showToast(pages.pos.emptyCart, "error");
      return;
    }

    const snapshot = cart;
    const snapshotType = orderType;
    const formData = buildFormData(targetStatus);
    if (!onSuccess) {
      clearCart();
      showToast(pages.pos.sentToast, "success");
    }

    startTransition(async () => {
      try {
        const result = await saveOrderAction({}, formData);

        if (result.error) {
          if (!onSuccess) {
            setCart(snapshot);
            setOrderType(snapshotType);
          }
          onError?.();
          showToast(result.error, "error");
          return;
        }

        if (!result.orderId) {
          if (!onSuccess) {
            setCart(snapshot);
            setOrderType(snapshotType);
          }
          onError?.();
          showToast(
            pages.retail
              ? "La vente n'a pas pu être créée. Réessayez."
              : "La commande n'a pas pu être créée. Réessayez.",
            "error",
          );
          return;
        }

        setOrderId(result.orderId);

        if (onSuccess) {
          await onSuccess(result.orderId);
          return;
        }

        startFreshOrder({
          toast: result.success ?? pages.pos.savedToast,
        });
      } catch (error) {
        if (!onSuccess) {
          setCart(snapshot);
          setOrderType(snapshotType);
        }
        onError?.();
        showToast(
          error instanceof Error
            ? error.message
            : pages.retail
              ? "Impossible d'enregistrer la vente. Réessayez."
              : "Impossible d'enregistrer la commande. Réessayez.",
          "error",
        );
      }
    });
  }

  /** Enregistre la commande puis ouvre la fenêtre d’impression du ticket. */
  function handlePrintAddition() {
    submitOrder("READY_TO_PAY", async (savedOrderId) => {
      router.push(`/application/caisse/addition/${savedOrderId}`);
    });
  }

  /** Enregistre la commande « à encaisser » puis ouvre un panier neuf. */
  function handleHold() {
    submitOrder("READY_TO_PAY", async () => {
      startFreshOrder({
        toast:
          pages.pos.holdToast,
        remount: true,
      });
    });
  }

  function handleNewOrder() {
    if (isPending) return;
    if (cart.length > 0) {
      const confirmed = window.confirm(
        "Le panier actuel sera vidé sans enregistrer. Continuer ?",
      );
      if (!confirmed) return;
    }
    startFreshOrder({
      toast: pages.retail ? "Nouvelle vente prête." : "Nouvelle commande prête.",
      remount: true,
    });
  }

  function closeCheckoutModal() {
    if (isPending) return;
    setCheckoutDraft(null);
    setCheckoutError(null);
    setCheckoutSuccess(null);
  }

  function handleNewOrderAfterCheckout() {
    clearCart();
    setCheckoutDraft(null);
    setCheckoutError(null);
    setCheckoutSuccess(null);
    setMobileTab("products");
    router.replace(`/application/caisse?fresh=1&t=${Date.now()}`);
  }

  function handleCheckout() {
    if (cart.length === 0) return;
    if (!session && !browseWithoutSession) {
      showToast("Ouvrez une session de caisse pour encaisser.", "error");
      return;
    }

    setCheckoutError(null);
    setCheckoutSuccess(null);
    setCheckoutDraft({
      source: "cart",
      existingOrderId: orderId || undefined,
      totalToPay: totalAmount,
    });
  }

  function openCheckoutForSavedOrder(order: OpenOrderListItem) {
    if (!session && !browseWithoutSession) {
      showToast("Ouvrez une session de caisse pour encaisser.", "error");
      return;
    }
    setShowOpenOrders(false);
    setCheckoutError(null);
    setCheckoutSuccess(null);
    setCheckoutDraft({
      source: "saved",
      existingOrderId: order.id,
      totalToPay: order.totalAmount,
      orderNumber: order.orderNumber,
    });
  }

  function handleConfirmCheckout(amountReceived: number) {
    if (!checkoutDraft) return;

    startTransition(async () => {
      setCheckoutError(null);

      try {
        let targetOrderId = checkoutDraft.existingOrderId;

        if (checkoutDraft.source === "cart") {
          if (cart.length === 0) {
            setCheckoutError("Ajoutez des articles avant d'encaisser.");
            return;
          }

          const saved = await saveOrderAction({}, buildFormData("READY_TO_PAY"));
          if (saved.error || !saved.orderId) {
            setCheckoutError(
              saved.error ??
                (pages.retail
                  ? "Impossible d'enregistrer la vente."
                  : "Impossible d'enregistrer la commande."),
            );
            return;
          }

          targetOrderId = saved.orderId;
          setOrderId(saved.orderId);
        }

        if (!targetOrderId) {
          setCheckoutError(pages.pos.notFound);
          return;
        }

        const result = await quickCashCheckoutAction(targetOrderId, amountReceived);

        if (result.error) {
          setCheckoutError(result.error);
          return;
        }

        clearCart();
        setCheckoutSuccess({
          receiptId: result.receiptId,
          changeGiven:
            result.changeGiven ?? Math.max(amountReceived - checkoutDraft.totalToPay, 0),
          totalPaid: checkoutDraft.totalToPay,
          orderNumber: checkoutDraft.orderNumber,
        });
        refreshSoon(() => router.refresh());
      } catch (error) {
        setCheckoutError(
          error instanceof Error
            ? error.message
            : "Une erreur inattendue est survenue. Veuillez réessayer.",
        );
      }
    });
  }

  function handleOpenSession(formData: FormData) {
    startOpenTransition(async () => {
      const result = await openCashSessionAction({}, formData);
      if (result.error) {
        setOpenError(result.error);
        return;
      }
      setOpenError(undefined);
      refreshSoon(() => router.refresh());
    });
  }

  usePosKeyboard({
    onSearch: () => searchInputRef.current?.focus(),
    onOpenOrders: () => setShowOpenOrders(true),
    onCheckout: () => {
      if (cart.length > 0 && !isPending && !checkoutDraft) handleCheckout();
    },
    onEscape: () => {
      if (checkoutDraft && !checkoutSuccess && !isPending) {
        closeCheckoutModal();
        return;
      }
      setShowOpenOrders(false);
      setShowCloseModal(false);
    },
  });

  const orderPanelProps = {
    tableReference,
    orderType,
    cart,
    subtotal,
    discountAmount,
    isPending,
    retailMode: retail,
    ticketTitle: profile.ticketTitle,
    clientPlaceholder: profile.clientPlaceholder,
    onTableChange: setTableReference,
    onOrderTypeChange: setOrderType,
    onQuantityChange: updateQuantity,
    onNotesChange: updateNotes,
    onRemove: removeLine,
    onHold: handleHold,
    onPrintAddition: handlePrintAddition,
    onCheckout: handleCheckout,
    onClear: clearCart,
    onNewOrder: handleNewOrder,
  };

  return (
    <FasoBarCaisseBridge
      categories={categories}
      departmentFilter={departmentFilter}
      categoryId={categoryId}
      search={search}
      searchInputRef={searchInputRef}
      serviceScope={serviceScope}
      onDepartmentChange={handleDepartmentChange}
      onCategoryChange={handleCategoryChange}
      onSearchChange={handleSearchChange}
      activityCode={activityCode}
      onCloseSession={handleCloseSession}
      onOpenOrders={handleOpenOrdersDrawer}
    >
      <div className="pos-workspace relative flex h-full w-full max-w-full flex-col overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
              mobileTab === "products" ? "flex" : "hidden lg:flex"
            }`}
          >
            <ProductGrid
            title={categoryTitle}
            products={filteredProducts}
            totalCount={totalProductCount}
            isPending={isPending}
            flashProductId={flashProductId}
            onAddProduct={addProduct}
            hasSearch={search.length > 0}
            search={search}
            onSearchChange={handleSearchChange}
            searchInputRef={searchInputRef}
          />
        </div>

        <div
          className={`min-h-0 self-stretch overflow-hidden ${
            mobileTab === "order"
              ? "flex h-full w-full flex-1 flex-col"
              : "hidden lg:flex lg:h-full lg:w-[420px] lg:flex-col xl:w-[420px]"
          }`}
        >
          <ActiveOrderPanel {...orderPanelProps} className="h-full min-h-0 flex-1" />
        </div>
      </div>

      {mobileTab === "products" && cart.length > 0 ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-3 py-3 lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">Total</p>
            <p className="pos-tabular truncate text-lg font-bold text-slate-900">
              {formatPriceXof(totalAmount)}
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={handleHold}
            className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-xs font-bold text-amber-900 disabled:opacity-50"
          >
            À encaisser
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleCheckout}
            className="min-h-12 shrink-0 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            Encaisser
          </button>
        </div>
      ) : null}

      <nav
        className="flex shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navigation caisse mobile"
      >
        <button
          type="button"
          onClick={() => setMobileTab("products")}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
            mobileTab === "products" ? "text-emerald-700" : "text-slate-500"
          }`}
        >
          <LayoutGrid className="h-5 w-5" />
          {pages.pos.productsTab}
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("order")}
          className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
            mobileTab === "order" ? "text-emerald-700" : "text-slate-500"
          }`}
        >
          <ShoppingBag className="h-5 w-5" />
          {pages.pos.cartTab}
          {cart.length > 0 ? (
            <span className="absolute right-[calc(50%-28px)] top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
              {cart.reduce((s, l) => s + l.quantity, 0)}
            </span>
          ) : null}
        </button>
      </nav>

      <OpenOrdersDrawer
        open={showOpenOrders}
        orders={openOrders}
        activityCode={activityCode}
        onClose={() => setShowOpenOrders(false)}
        onResume={(id) => router.push(`/application/caisse?order=${id}`)}
        onCheckout={(id) => {
          const order = openOrders.find((item) => item.id === id);
          if (!order) return;
          openCheckoutForSavedOrder(order);
        }}
      />

      {checkoutDraft ? (
        <CashCheckoutModal
          key={`${checkoutDraft.source}-${checkoutDraft.existingOrderId ?? "cart"}-${checkoutDraft.totalToPay}`}
          totalToPay={checkoutDraft.totalToPay}
          orderNumber={checkoutDraft.orderNumber}
          isPending={isPending}
          error={checkoutError}
          success={checkoutSuccess}
          onConfirm={handleConfirmCheckout}
          onClose={closeCheckoutModal}
          onNewOrder={handleNewOrderAfterCheckout}
        />
      ) : null}

      {!session && !browseWithoutSession ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]"
            aria-hidden="true"
          />
          <OpenSessionModal
            formAction={handleOpenSession}
            error={openError}
            isPending={isOpening}
            cashierName={cashierName}
          />
        </>
      ) : null}

      {session && showCloseModal ? (
        <CloseSessionModal
          session={session}
          onClose={() => setShowCloseModal(false)}
          onClosed={() => {
            setShowCloseModal(false);
            refreshSoon(() => router.refresh());
          }}
        />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-[70] w-full max-w-md -translate-x-1/2 px-4 lg:bottom-6">
          <PosToast
            message={toast.message}
            tone={toast.tone}
            onDismiss={() => setToast(null)}
          />
        </div>
      ) : null}
      </div>
    </FasoBarCaisseBridge>
  );
}
