"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Package,
  PackagePlus,
  Pencil,
  Power,
  Search,
  UtensilsCrossed,
  Wine,
} from "lucide-react";

import {
  createProductAction,
  toggleProductStatusAction,
  updateProductAction,
  updateProductPriceAction,
} from "@/app/(protected)/application/produits/actions";
import { refreshSoon } from "@/lib/ops/client-refresh";
import { AlertMessage } from "@/components/auth/alert-message";
import { ProductFormModal, type ProductFormState } from "@/components/products/product-form-modal";
import type { ProductImageAssets } from "@/components/products/product-image-field";
import { resolveCatalogImageUrl } from "@/lib/fasobar/product-images";
import {
  BAR_PACKAGING_DEFAULT_UNITS,
  formatPriceXof,
  PRODUCT_TABS,
  PRODUCT_UNIT_LABELS,
} from "@/lib/products/constants";
import type {
  CategoryOption,
  ProductListItem,
  ProductPackaging,
  ProductStats,
} from "@/lib/products/types";
import type { ProductTab } from "@/lib/products/schemas";

type ProductsWorkspaceProps = {
  establishmentName: string;
  products: ProductListItem[];
  categories: CategoryOption[];
  packagingsByProductId?: Record<string, ProductPackaging[]>;
  stats: ProductStats;
  initialTab: ProductTab;
  initialSearch: string;
  initialCategoryId: string;
  canManage: boolean;
};

type FormMode = "create" | "edit" | null;

const emptyForm: ProductFormState = {
  name: "",
  departmentCode: "BAR",
  categoryId: "",
  sellingPrice: 0,
  unit: "BOTTLE",
  minimumStock: 0,
  description: "",
  active: true,
  packagingUnit: "CASE",
  unitsPerPack: BAR_PACKAGING_DEFAULT_UNITS.CASE,
};

export function ProductsWorkspace({
  establishmentName,
  products,
  categories,
  packagingsByProductId = {},
  stats,
  initialTab,
  initialSearch,
  initialCategoryId,
  canManage,
}: ProductsWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [tab, setTab] = useState<ProductTab>(initialTab);
  const [search, setSearch] = useState(initialSearch);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingProduct, setEditingProduct] = useState<ProductListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProductFormState>(emptyForm);
  const [imageAssets, setImageAssets] = useState<ProductImageAssets>({
    originalFile: null,
    optimizedFile: null,
    selection: "optimized",
  });
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [rows, setRows] = useState(products);

  useEffect(() => {
    setRows(products);
  }, [products]);

  function resetImageAssets() {
    setImageAssets({
      originalFile: null,
      optimizedFile: null,
      selection: "optimized",
    });
  }

  function applyFilters(nextTab = tab, nextSearch = search, nextCategoryId = categoryId) {
    const params = new URLSearchParams();
    params.set("tab", nextTab);
    if (nextSearch) params.set("search", nextSearch);
    if (nextCategoryId) params.set("category", nextCategoryId);
    router.push(`/application/produits?${params.toString()}`);
  }

  function openCreateForm() {
    setEditingProduct(null);
    setFormState({
      ...emptyForm,
      categoryId: categories.find((category) => category.departmentCode === "BAR")?.id ?? "",
    });
    resetImageAssets();
    setFormMode("create");
    setFormError(null);
    setError(null);
    setMessage(null);
  }

  function openEditForm(product: ProductListItem) {
    setEditingProduct(product);
    const existingPackaging = packagingsByProductId[product.id]?.[0];
    setFormState({
      name: product.name,
      departmentCode: product.departmentCode as ProductFormState["departmentCode"],
      categoryId: product.categoryId,
      sellingPrice: product.sellingPrice,
      unit: product.unit as ProductFormState["unit"],
      minimumStock: product.minimumStock,
      description: product.description ?? "",
      active: product.active,
      packagingUnit:
        (existingPackaging?.packagingUnit as ProductFormState["packagingUnit"]) ??
        "CASE",
      unitsPerPack:
        existingPackaging?.conversionFactor ?? BAR_PACKAGING_DEFAULT_UNITS.CASE,
    });
    resetImageAssets();
    setFormMode("edit");
    setFormError(null);
    setError(null);
    setMessage(null);
  }

  function closeForm() {
    setFormMode(null);
    setFormError(null);
    resetImageAssets();
  }

  async function handleSubmitForm(formData: FormData) {
    setFormError(null);
    setIsSavingProduct(true);

    try {
      const result =
        formMode === "edit"
          ? await updateProductAction({}, formData)
          : await createProductAction({}, formData);

      if (result.error) {
        setFormError(result.error);
        return;
      }

      setMessage(result.success ?? "Opération réussie.");
      setFormError(null);
      setError(null);
      setFormMode(null);
      resetImageAssets();
      refreshSoon(() => router.refresh());
    } catch (submitError) {
      console.error("[handleSubmitForm]", submitError);
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible d'enregistrer le produit. Réessayez.",
      );
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handlePriceUpdate(productId: string) {
    const value = Number(priceDrafts[productId]);
    const previous = rows.find((row) => row.id === productId)?.sellingPrice;
    setRows((current) =>
      current.map((row) =>
        row.id === productId ? { ...row, sellingPrice: value } : row,
      ),
    );
    setMessage("Prix mis à jour.");
    setError(null);

    const result = await updateProductPriceAction(productId, value);
    if (result.error) {
      if (previous != null) {
        setRows((current) =>
          current.map((row) =>
            row.id === productId ? { ...row, sellingPrice: previous } : row,
          ),
        );
      }
      setError(result.error);
      setMessage(null);
    }
  }

  async function handleToggleStatus(product: ProductListItem) {
    const nextActive = !product.active;
    setRows((current) =>
      current.map((row) =>
        row.id === product.id ? { ...row, active: nextActive } : row,
      ),
    );
    setMessage(nextActive ? "Produit activé." : "Produit désactivé.");
    setError(null);

    const result = await toggleProductStatusAction(product.id, nextActive);
    if (result.error) {
      setRows((current) =>
        current.map((row) =>
          row.id === product.id ? { ...row, active: product.active } : row,
        ),
      );
      setError(result.error);
      setMessage(null);
    }
  }

  const filteredCategories =
    tab === "bar"
      ? categories.filter((c) => c.departmentCode === "BAR")
      : tab === "kitchen"
        ? categories.filter((c) => c.departmentCode === "KITCHEN")
        : categories;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden px-4 py-3 lg:gap-3.5 lg:px-5 lg:py-4">
      <header className="flex shrink-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900 lg:text-[22px]">
            Produits
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Établissement actif :{" "}
            <span className="font-medium text-slate-700">{establishmentName}</span>
          </p>
        </div>

        {canManage ? (
          <button
            type="button"
            onClick={openCreateForm}
            disabled={isPending}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
          >
            <PackagePlus className="h-3.5 w-3.5" />
            Ajouter un produit
          </button>
        ) : null}
      </header>

      {(error || message) && (
        <div className="shrink-0 space-y-2">
          {error ? <AlertMessage message={error} /> : null}
          {message ? <AlertMessage message={message} tone="success" /> : null}
        </div>
      )}

      <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-4 lg:gap-3">
        <StatCard
          title="Catalogue"
          value={String(stats.total)}
          subtitle="produits au total"
          icon={Package}
          tone="emerald"
        />
        <StatCard
          title="Boissons"
          value={String(stats.barCount)}
          subtitle="actifs · bar"
          icon={Wine}
          tone="sky"
        />
        <StatCard
          title="Nourriture"
          value={String(stats.kitchenCount)}
          subtitle="actifs · cuisine"
          icon={UtensilsCrossed}
          tone="violet"
        />
        <StatCard
          title="Indisponibles"
          value={String(stats.inactiveCount)}
          subtitle="désactivés"
          icon={Power}
          tone="amber"
        />
      </div>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-slate-100 px-3.5 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {PRODUCT_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setCategoryId("");
                  applyFilters(item.id, search, "");
                }}
                className={`inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-semibold transition ${
                  tab === item.id
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}
            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {rows.length} affiché{rows.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="relative min-w-[160px] flex-1 lg:max-w-[220px]">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    applyFilters(tab, search, categoryId);
                  }
                }}
                placeholder="Rechercher…"
                className="h-8 w-full rounded-lg border border-slate-200 bg-white pr-2.5 pl-8 text-[12px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                applyFilters(tab, search, event.target.value);
              }}
              className="h-8 min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              aria-label="Filtrer par catégorie"
            >
              <option value="">Toutes les catégories</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="app-scroll min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur">
              <tr>
                <th className="px-3.5 py-2.5 font-medium">Produit</th>
                <th className="px-3.5 py-2.5 font-medium">Département</th>
                <th className="px-3.5 py-2.5 font-medium">Catégorie</th>
                <th className="px-3.5 py-2.5 font-medium">Prix</th>
                <th className="px-3.5 py-2.5 font-medium">Unité</th>
                <th className="px-3.5 py-2.5 font-medium">Stock min.</th>
                <th className="px-3.5 py-2.5 font-medium">Statut</th>
                {canManage ? (
                  <th className="px-3.5 py-2.5 text-right font-medium">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 8 : 7}
                    className="px-3.5 py-12 text-center text-[13px] text-slate-500"
                  >
                    Aucun produit trouvé pour ces filtres.
                  </td>
                </tr>
              ) : (
                rows.map((product) => {
                  const imageUrl = resolveCatalogImageUrl(product);

                  return (
                  <tr key={product.id} className="text-slate-700 hover:bg-slate-50/70">
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                          <Image
                            src={imageUrl}
                            alt={product.name}
                            fill
                            className="object-contain p-0.5"
                            sizes="40px"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{product.name}</p>
                          {product.description ? (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                              {product.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <DepartmentBadge
                        code={product.departmentCode}
                        label={product.departmentName}
                      />
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">{product.categoryName}</td>
                    <td className="px-3.5 py-2.5">
                      {canManage ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            value={priceDrafts[product.id] ?? String(product.sellingPrice)}
                            onChange={(event) =>
                              setPriceDrafts((current) => ({
                                ...current,
                                [product.id]: event.target.value,
                              }))
                            }
                            className="h-7 w-24 rounded-md border border-slate-200 px-2 text-[12px] tabular-nums outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                            aria-label={`Prix de ${product.name}`}
                          />
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handlePriceUpdate(product.id)}
                            title="Enregistrer le prix"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="font-semibold tabular-nums text-slate-900">
                          {formatPriceXof(product.sellingPrice)}
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">
                      {PRODUCT_UNIT_LABELS[product.unit as keyof typeof PRODUCT_UNIT_LABELS] ??
                        product.unit}
                    </td>
                    <td className="px-3.5 py-2.5 tabular-nums text-slate-600">
                      {product.minimumStock}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          product.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {product.active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    {canManage ? (
                      <td className="px-3.5 py-2.5">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <ActionButton
                            icon={Pencil}
                            label="Modifier"
                            onClick={() => openEditForm(product)}
                          />
                          <ActionButton
                            icon={Power}
                            label={product.active ? "Désactiver" : "Activer"}
                            onClick={() => handleToggleStatus(product)}
                          />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {formMode && canManage ? (
        <ProductFormModal
          mode={formMode}
          formState={formState}
          categories={categories}
          editingProduct={editingProduct}
          packagings={
            editingProduct ? (packagingsByProductId[editingProduct.id] ?? []) : []
          }
          formError={formError}
          imageAssets={imageAssets}
          isPending={isSavingProduct}
          onClose={closeForm}
          onSubmit={handleSubmitForm}
          onChange={(updater) => setFormState(updater)}
          onImageAssetsChange={setImageAssets}
          onPackagingsChanged={() => refreshSoon(() => router.refresh())}
          onClientValidationError={setFormError}
        />
      ) : null}
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "amber" | "sky" | "violet";
};

function StatCard({ title, value, subtitle, icon: Icon, tone }: StatCardProps) {
  const toneClasses = {
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-orange-50 text-orange-600",
    sky: "bg-sky-50 text-sky-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <article className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-500">{title}</p>
          <p className="mt-0.5 truncate text-[16px] font-bold tracking-tight tabular-nums text-slate-900 lg:text-[17px]">
            {value}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
        </div>
      </div>
    </article>
  );
}

function DepartmentBadge({ code, label }: { code: string; label: string }) {
  const isBar = code === "BAR";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        isBar
          ? "border-sky-100 bg-sky-50 text-sky-800"
          : "border-orange-100 bg-orange-50 text-orange-800"
      }`}
    >
      {label}
    </span>
  );
}

type ActionButtonProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
};

function ActionButton({ icon: Icon, label, onClick }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
    >
      <Icon className="h-3 w-3" />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
