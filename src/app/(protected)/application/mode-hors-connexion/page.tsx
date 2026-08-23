import { InstantLink as Link } from "@/components/layout/instant-link";
import { WifiOff } from "lucide-react";

type ModeHorsConnexionPageProps = {
  searchParams: Promise<{ from?: string }>;
};

export default async function ModeHorsConnexionPage({
  searchParams,
}: ModeHorsConnexionPageProps) {
  const params = await searchParams;
  const backHref =
    params.from && params.from.startsWith("/application")
      ? params.from
      : "/application/caisse";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f4f6f9] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
          <WifiOff className="h-5 w-5" aria-hidden />
        </div>
        <p className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-emerald-700">
          FasoBar
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          Mode hors connexion
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Cette fonctionnalité nécessite Internet (administration, paramètres
          sensibles, abonnement ou opérations cloud).
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          La caisse reste disponible en continuité minimale : catalogue local,
          session ouverte, ventes espèces et reçus. La synchronisation
          reprendra automatiquement au retour du réseau.
        </p>
        <Link
          href={backHref}
          className="mt-6 inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-800"
        >
          Retour à la caisse
        </Link>
      </div>
    </div>
  );
}
