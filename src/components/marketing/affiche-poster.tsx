import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { FASOBAR_WHATSAPP } from "@/lib/marketing/config";
import { formatPriceAmountXof, KIT_PLUS_YEARLY_XOF } from "@/lib/marketing/plan-constants";

const YEARLY_SOFTWARE = 100_000;

export function AffichePoster() {
  return (
    <article className="mx-auto w-full max-w-[794px] overflow-hidden rounded-none bg-[#07110e] text-white shadow-2xl print:max-w-none print:shadow-none">
      <div className="px-8 py-8 sm:px-10 sm:py-10">
        <FasoBarLogo size="lg" tone="dark" />
        <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-amber-300">
          Burkina Faso
        </p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">
          Logiciel de gestion de stock
          <span className="mt-1 block text-emerald-300">pour tout type de commerce</span>
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-emerald-50/80">
          Boutique, pharmacie, quincaillerie, maquis, restaurant.
        </p>
      </div>

      <div className="px-8 sm:px-10">
        <img
          src="/brand/banner/02-caisse.png"
          alt="Caisse tactile, clavier, souris et imprimante thermique"
          className="h-52 w-full rounded-2xl object-cover sm:h-64"
        />
      </div>

      <div className="mt-8 grid gap-3 px-8 sm:grid-cols-2 sm:px-10">
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300">
            Logiciel seul
          </p>
          <p className="mt-2 text-[28px] font-bold tabular-nums">
            {formatPriceAmountXof(YEARLY_SOFTWARE)}{" "}
            <span className="text-[14px] font-semibold text-emerald-100/80">FCFA / an</span>
          </p>
          <p className="mt-2 text-[13px] text-emerald-50/75">
            Abonnement annuel, suivi et aide.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-300/50 bg-amber-400/15 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">
            Kit + abonnement
          </p>
          <p className="mt-2 text-[28px] font-bold tabular-nums text-amber-100">
            {formatPriceAmountXof(KIT_PLUS_YEARLY_XOF)}{" "}
            <span className="text-[14px] font-semibold">FCFA</span>
          </p>
          <p className="mt-2 text-[13px] text-emerald-50/90">
            Caisse tactile, clavier, souris, imprimante thermique, installation
            du logiciel, abonnement 12 mois, suivi et aide.
          </p>
        </div>
      </div>

      <div className="mt-8 border-t border-white/10 px-8 py-6 sm:px-10">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-amber-300">
          Contact
        </p>
        <p className="mt-1 text-[26px] font-bold tabular-nums tracking-tight">
          {FASOBAR_WHATSAPP.display}
        </p>
        <p className="mt-1 text-[13px] text-emerald-50/70">WhatsApp</p>
      </div>
    </article>
  );
}
