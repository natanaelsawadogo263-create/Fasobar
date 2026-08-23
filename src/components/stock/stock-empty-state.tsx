import { Package } from "lucide-react";
import { InstantLink as Link } from "@/components/layout/instant-link";

type StockEmptyStateProps = {
  canManage: boolean;
  filtered?: boolean;
  drinksOnly?: boolean;
  retail?: boolean;
};

export function StockEmptyState({
  canManage,
  filtered = false,
  drinksOnly = false,
  retail = false,
}: StockEmptyStateProps) {
  if (filtered) {
    return (
      <div className="px-4 py-10 text-center text-slate-500">
        Aucun article ne correspond à ces filtres.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Package className="h-8 w-8" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-slate-900">
        {retail
          ? "Aucun article en stock"
          : drinksOnly
            ? "Aucun article boissons"
            : "Aucun article de stock"}
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        {retail
          ? "Les articles apparaissent automatiquement quand vous les créez dans le catalogue. Créez d’abord un article, puis enregistrez une entrée."
          : drinksOnly
          ? "Les articles bar apparaissent automatiquement quand l'administrateur crée des produits boissons. Ensuite, enregistrez une entrée pour alimenter le stock."
          : "Les articles apparaissent automatiquement quand vous créez des produits bar dans le catalogue. Créez d'abord un produit, puis enregistrez une entrée."}
      </p>
      {canManage && !drinksOnly ? (
        <Link
          href="/application/produits"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
            {retail ? "Aller au catalogue" : "Aller aux produits"}
        </Link>
      ) : null}
    </div>
  );
}
