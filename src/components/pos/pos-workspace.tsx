"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { InstantLink } from "@/components/layout/instant-link";
import { ClipboardList, LayoutGrid, ShoppingBag, Timer } from "lucide-react";

import {
  getProductSaleUnitsAction,
  saveOrderAction,
} from "@/app/(protected)/application/caisse/actions";
import {
  openCashSessionAction,
  quickCashCheckoutAction,
} from "@/app/(protected)/application/caisse/payment-actions";
import { FasoBarCaisseBridge } from "@/components/fasobar/fasobar-caisse-bridge";
import { StepperNumberInput } from "@/components/ui/form-controls";
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
import {
  buildCashierSaleChoices,
  salePickerHint,
  type CashierSaleChoice,
  type CashierSaleKind,
} from "@/lib/catalog/sale-choices";
import { stockQtyFromAmount } from "@/lib/catalog/sale-stock";
import { usesOptionalProductLots } from "@/lib/activity/catalog";
import { usesTradeCatalog } from "@/lib/activity/ops-model";
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
    saleUnitId: item.saleUnitId ?? undefined,
    notes: item.notes ?? undefined,
    available: true,
    allowDecimal: Boolean(item.saleUnitFactor && item.saleUnitFactor !== 1) || !Number.isInteger(item.quantity),
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

function HardwareOrSalePicker({
  product,
  hardware,
  shopLots,
  saleMode,
  weightQty,
  detailAmount,
  onSaleMode,
  onQty,
  onAmount,
  onAdd,
  onClose,
}: {
  product: CashierProduct;
  hardware: boolean;
  shopLots: boolean;
  saleMode: CashierSaleKind | null;
  weightQty: string;
  detailAmount: string;
  onSaleMode: (mode: CashierSaleKind | null) => void;
  onQty: (value: string) => void;
  onAmount: (value: string) => void;
  onAdd: (product: CashierProduct, unit?: CashierSaleChoice, quantity?: number) => void;
  onClose: () => void;
}) {
  const choiceOptions = shopLots ? { shopLots: true } : undefined;
  const choices = buildCashierSaleChoices(product, choiceOptions);
  const unitChoice = choices.find((item) => item.kind === "unit");
  const packChoices = choices.filter((item) => item.kind === "pack");
  const detailChoice = choices.find((item) => item.kind === "detail");
  const simple = hardware && packChoices.length === 0 && !detailChoice;
  const amount = Number(detailAmount);
  const detailQty =
    detailChoice && amount > 0 ? stockQtyFromAmount(amount, detailChoice.price) : 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        className="w-full rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:max-w-md sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          {simple ? "Ajouter au ticket" : shopLots ? "Unité ou lot ?" : "Comment le client achète"}
        </p>
        <h2 className="mt-1 text-[16px] font-semibold text-slate-900">{product.name}</h2>
        {salePickerHint(choices, choiceOptions) ? (
          <p className="mt-1 text-[13px] text-slate-500">{salePickerHint(choices, choiceOptions)}</p>
        ) : null}

        {simple && unitChoice ? (
          <div className="mt-3 grid gap-2">
            <p className="text-[14px] font-bold text-emerald-700">{formatPriceXof(unitChoice.price)}</p>
            <label htmlFor="pos-unit-qty" className="text-[13px] font-medium text-slate-700">
              Quantité
            </label>
            <StepperNumberInput
              id="pos-unit-qty"
              min={1}
              step="1"
              inputMode="numeric"
              value={weightQty}
              onChange={(event) => onQty(event.target.value)}
              inputClassName="h-12 rounded-xl border border-slate-200 px-3 text-[16px] outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 text-[14px] font-semibold text-white"
              onClick={() => onAdd(product, unitChoice, Number(weightQty) || 1)}
            >
              Ajouter au panier
            </button>
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            {choices.map((unit) => (
              <button
                key={`${unit.kind}-${unit.id || unit.title}`}
                type="button"
                className={`flex min-h-14 flex-col justify-center rounded-xl border px-4 py-2 text-left ${
                  saleMode === unit.kind
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-slate-200"
                }`}
                onClick={() => {
                  if (unit.kind === "pack") {
                    onAdd(product, unit, 1);
                    return;
                  }
                  if (unit.kind === "unit" && !hardware) {
                    onAdd(product, unit, 1);
                    return;
                  }
                  onSaleMode(unit.kind);
                  onQty("1");
                  onAmount("");
                }}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-slate-900">{unit.title}</span>
                  {unit.kind !== "detail" ? (
                    <span className="text-[14px] font-bold tabular-nums text-emerald-700">
                      {formatPriceXof(unit.price)}
                    </span>
                  ) : null}
                </span>
                {unit.hint ? (
                  <span className="mt-0.5 text-[12px] text-slate-500">{unit.hint}</span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        {saleMode === "unit" && unitChoice && hardware ? (
          <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3">
            <label htmlFor="pos-mode-qty" className="text-[13px] font-medium text-slate-700">
              Quantité ({unitChoice.name})
            </label>
            <StepperNumberInput
              id="pos-mode-qty"
              min={1}
              step="1"
              inputMode="numeric"
              value={weightQty}
              onChange={(event) => onQty(event.target.value)}
              inputClassName="h-12 rounded-xl border border-slate-200 px-3 text-[16px] outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 text-[14px] font-semibold text-white"
              onClick={() => onAdd(product, unitChoice, Number(weightQty) || 1)}
            >
              Ajouter
            </button>
          </div>
        ) : null}

        {saleMode === "detail" && detailChoice ? (
          <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3">
            <label htmlFor="pos-detail-amount" className="text-[13px] font-medium text-slate-700">
              Montant demandé (F)
            </label>
            <StepperNumberInput
              id="pos-detail-amount"
              min={1}
              step="1"
              inputMode="numeric"
              value={detailAmount}
              onChange={(event) => onAmount(event.target.value)}
              inputClassName="h-12 rounded-xl border border-slate-200 px-3 text-[16px] outline-none focus:border-emerald-500"
            />
            {detailQty > 0 ? (
              <p className="text-[13px] leading-snug text-slate-700">
                {formatPriceXof(amount)} / {formatPriceXof(detailChoice.price)} ={" "}
                <strong>
                  {detailQty} {detailChoice.name}
                </strong>{" "}
                retirés du stock.
              </p>
            ) : null}
            <button
              type="button"
              disabled={!(detailQty > 0)}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 text-[14px] font-semibold text-white disabled:opacity-50"
              onClick={() => onAdd(product, { ...detailChoice, allowDecimal: true }, detailQty)}
            >
              Ajouter
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700"
          onClick={onClose}
        >
          Annuler
        </button>
      </div>
    </div>
  );
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
  const shopLots = usesOptionalProductLots(activityCode);
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
  const [isResolvingSale, startSaleResolve] = useTransition();
  const [toast, setToast] = useState<ToastState>(null);
  const [openError, setOpenError] = useState<string | undefined>();
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showOpenOrders, setShowOpenOrders] = useState(false);
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<CashCheckoutSuccess | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("products");
  const [salePicker, setSalePicker] = useState<CashierProduct | null>(null);
  const [saleMode, setSaleMode] = useState<CashierSaleKind | null>(null);
  const [weightQty, setWeightQty] = useState("1");
  const [detailAmount, setDetailAmount] = useState("");
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
      if (search) {
        const query = search.toLowerCase().trim();
        const nameMatch = product.name.toLowerCase().includes(query);
        const barcodeMatch = product.barcode?.toLowerCase().includes(query);
        if (!nameMatch && !barcodeMatch) return false;
      }
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

  const showToast = (message: string, tone: ToastTone = "info") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4000);
  };

  const handleCloseSession = () => {
    setShowCloseModal(true);
  };

  const handleOpenOrdersDrawer = () => {
    setShowOpenOrders(true);
  };

  const handleDepartmentChange = (filter: DepartmentFilter) => {
    setDepartmentFilter(filter);
  };

  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  function addSaleUnit(
    product: CashierProduct,
    unit?: { id: string; name: string; price: number; factor: number; allowDecimal?: boolean },
    quantity = 1,
  ) {
    if (isProductOutOfStock(product)) return;
    const factor = unit?.factor ?? 1;
    const unitId = unit?.id;
    const unitPrice = unit?.price ?? product.sellingPrice;
    const qty = Math.round(quantity * 1000) / 1000;
    if (!(qty > 0)) return;
    const unitName =
      unit && unit.factor !== 1
        ? `${product.name} (${unit.name})`
        : unit?.allowDecimal && qty !== 1
          ? `${product.name} (détail)`
          : product.name;
    setFlashProductId(product.id);
    window.setTimeout(() => setFlashProductId(null), 180);
    setSalePicker(null);
    setSaleMode(null);
    setWeightQty("1");
    setDetailAmount("");

    setCart((current) => {
      const existing = current.find(
        (line) => line.productId === product.id && (line.saleUnitId ?? "") === (unitId ?? ""),
      );
      if (existing) {
        return current.map((line) =>
          line.productId === product.id && (line.saleUnitId ?? "") === (unitId ?? "")
            ? { ...line, quantity: Math.round((line.quantity + qty) * 1000) / 1000 }
            : line,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: unitName,
          unitPrice,
          quantity: qty,
          departmentCode: product.departmentCode,
          departmentName: product.departmentName,
          categoryName: product.categoryName,
          unit: unit?.name ?? product.unit,
          saleUnitId: unitId,
          stockFactor: factor,
          allowDecimal: Boolean(unit?.allowDecimal),
          available: true,
        },
      ];
    });
  }

  function openSaleFlow(product: CashierProduct) {
    const choices = buildCashierSaleChoices(
      product,
      shopLots ? { shopLots: true } : undefined,
    );
    if (usesTradeCatalog(activityCode)) {
      setSalePicker(product);
      setSaleMode(null);
      setWeightQty("1");
      setDetailAmount("");
      return;
    }
    if (choices.length > 1) {
      setSalePicker(product);
      setSaleMode(null);
      setWeightQty("1");
      return;
    }
    addSaleUnit(product, choices[0]);
  }

  function addProduct(product: CashierProduct) {
    if (shopLots) {
      startSaleResolve(async () => {
        try {
          const units = await getProductSaleUnitsAction(product.id);
          const hydrated = { ...product, saleUnits: units };
          openSaleFlow(hydrated);
        } catch {
          openSaleFlow({ ...product, saleUnits: product.saleUnits ?? [] });
        }
      });
      return;
    }

    const needsUnits = !product.saleUnits || product.saleUnits.length === 0;
    if (!needsUnits) {
      openSaleFlow(product);
      return;
    }
    startSaleResolve(async () => {
      try {
        const units = await getProductSaleUnitsAction(product.id);
        const hydrated =
          units.length > 0 ? { ...product, saleUnits: units } : { ...product, saleUnits: product.saleUnits ?? [] };
        openSaleFlow(hydrated);
      } catch {
        openSaleFlow({ ...product, saleUnits: product.saleUnits ?? [] });
      }
    });
  }

  function lineMatches(line: CartLine, productId: string, saleUnitId?: string) {
    return line.productId === productId && (line.saleUnitId ?? "") === (saleUnitId ?? "");
  }

  function updateQuantity(productId: string, quantity: number, saleUnitId?: string) {
    if (quantity <= 0) {
      setCart((current) =>
        current.filter((line) => !lineMatches(line, productId, saleUnitId)),
      );
      return;
    }
    setCart((current) =>
      current.map((line) =>
        lineMatches(line, productId, saleUnitId) ? { ...line, quantity } : line,
      ),
    );
  }

  function updateNotes(productId: string, notes: string, saleUnitId?: string) {
    setCart((current) =>
      current.map((line) =>
        lineMatches(line, productId, saleUnitId) ? { ...line, notes } : line,
      ),
    );
  }

  function removeLine(productId: string, saleUnitId?: string) {
    setCart((current) =>
      current.filter((line) => !lineMatches(line, productId, saleUnitId)),
    );
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
          unitPrice: Math.round(line.unitPrice),
          productName: line.name,
          saleUnitId: line.saleUnitId || null,
          stockFactor: line.stockFactor,
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
          pages.retail
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
        retail
          ? "Vider le panier sans enregistrer cette vente ?"
          : "Vider le panier sans enregistrer cette commande ?",
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
      } catch (error) {
        setCheckoutError("L’encaissement n’a pas abouti. Réessayez.");
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
            aria-busy={isResolvingSale}
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
            shopLots={shopLots}
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
        <InstantLink
          href="/application/commandes-ouvertes"
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-slate-500 active:text-emerald-700"
        >
          <ClipboardList className="h-5 w-5" />
          {profile.openTicketsNavLabel}
        </InstantLink>
        <InstantLink
          href="/application/caisse/session"
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
            session ? "text-slate-500 active:text-emerald-700" : "text-slate-300"
          }`}
          onClick={(event) => {
            if (!session) {
              event.preventDefault();
              showToast("Ouvrez d’abord la caisse pour voir la session.", "info");
            }
          }}
        >
          <Timer className="h-5 w-5" />
          Session
        </InstantLink>
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
          retail={retail}
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
            cashierLabel={`${profile.cashierSpaceLabel} connecté`}
          />
        </>
      ) : null}

      {salePicker ? (
        <HardwareOrSalePicker
          product={salePicker}
          hardware={usesTradeCatalog(activityCode)}
          shopLots={shopLots}
          saleMode={saleMode}
          weightQty={weightQty}
          detailAmount={detailAmount}
          onSaleMode={setSaleMode}
          onQty={setWeightQty}
          onAmount={setDetailAmount}
          onAdd={addSaleUnit}
          onClose={() => {
            setSalePicker(null);
            setSaleMode(null);
            setDetailAmount("");
          }}
        />
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
