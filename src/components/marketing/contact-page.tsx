import {
  Headphones,
  MapPin,
  MessageCircle,
  Monitor,
  Phone,
  Receipt,
  ShieldCheck,
} from "lucide-react";

import { FASOBAR_WHATSAPP, whatsappHref } from "@/lib/marketing/config";

const INTENTS = [
  {
    href: whatsappHref(
      "Bonjour, je souhaite commander le kit FasoBar (caisse, clavier, souris, imprimante) + abonnement annuel.",
    ),
    icon: Monitor,
    title: "Commander le kit",
    body: "Caisse tactile, clavier, souris, imprimante, installation.",
  },
  {
    href: whatsappHref(
      "Bonjour, j’ai une question sur les tarifs FasoBar (mensuel, annuel, kit).",
    ),
    icon: Receipt,
    title: "Tarifs et abonnement",
    body: "Mensuel, annuel, ou kit + 12 mois.",
  },
  {
    href: whatsappHref(
      "Bonjour, j’ai besoin d’aide sur FasoBar (caisse, stock ou compte).",
    ),
    icon: Headphones,
    title: "Aide et suivi",
    body: "Un souci sur le logiciel ou votre établissement.",
  },
] as const;

const POINTS = [
  {
    icon: MessageCircle,
    title: "WhatsApp en priorité",
    body: "Le canal le plus rapide. Un message, une réponse.",
  },
  {
    icon: MapPin,
    title: "Burkina Faso",
    body: "Accompagnement local, installation et suivi.",
  },
  {
    icon: ShieldCheck,
    title: "Commerce réel",
    body: "Boutique, pharmacie, quincaillerie, maquis, restaurant.",
  },
] as const;

export function MarketingContactPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#07110e] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
          style={{
            background:
              "radial-gradient(80% 60% at 90% 0%, rgba(16,185,129,0.28), transparent 55%), radial-gradient(50% 40% at 0% 100%, rgba(251,191,36,0.12), transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-amber-300">
            Contact
          </p>
          <h1 className="mt-3 max-w-2xl text-[32px] font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            Une équipe, un numéro.
            <span className="mt-2 block text-emerald-300">On vous répond.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-emerald-50/75 sm:text-[16px]">
            Kit, abonnement, installation ou question sur FasoBar : écrivez-nous
            sur WhatsApp. C’est le canal officiel.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={FASOBAR_WHATSAPP.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#128C7E] px-5 text-[15px] font-semibold text-white transition hover:bg-[#0f7a6e]"
            >
              <WhatsAppGlyph className="h-5 w-5" />
              WhatsApp {FASOBAR_WHATSAPP.display}
            </a>
            <a
              href={`tel:+${FASOBAR_WHATSAPP.e164}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 text-[15px] font-semibold text-white transition hover:bg-white/15"
            >
              <Phone className="h-4 w-4" strokeWidth={2.25} />
              Appeler
            </a>
          </div>
        </div>
      </section>

      <section className="bg-[#f4f6f4] px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:pb-20">
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-3">
            {INTENTS.map((intent) => {
              const Icon = intent.icon;
              return (
                <a
                  key={intent.title}
                  href={intent.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[72px] items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm sm:p-5"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                    <Icon className="h-5 w-5" strokeWidth={2.1} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold text-slate-900">
                      {intent.title}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-slate-600">
                      {intent.body}
                    </span>
                  </span>
                </a>
              );
            })}
        </div>

        <div className="mx-auto mt-8 grid max-w-6xl gap-3 sm:grid-cols-3">
          {POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <div
                key={point.title}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5"
              >
                <Icon className="h-5 w-5 text-emerald-800" strokeWidth={2.1} />
                <p className="mt-3 text-[14px] font-semibold text-slate-900">
                  {point.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                  {point.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function WhatsAppGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      aria-hidden
      fill="currentColor"
    >
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.4a10.1 10.1 0 0 0 4.65 1.18h.01c5.46 0 9.89-4.4 9.89-9.84C21.94 6.4 17.5 2 12.04 2Zm0 17.97h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.2.83.85-3.12-.2-.32a8.14 8.14 0 0 1-1.25-4.37c0-4.5 3.68-8.16 8.21-8.16 4.37 0 8.2 3.66 8.2 8.16 0 4.5-3.83 8.16-8.12 8.16Zm4.5-6.12c-.25-.12-1.46-.72-1.68-.8-.23-.08-.4-.12-.56.12-.17.25-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.45-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42h-.48c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05 0 1.2.88 2.37 1 2.53.12.16 1.73 2.64 4.2 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.46-.6 1.66-1.17.2-.57.2-1.07.14-1.17-.06-.1-.23-.16-.48-.28Z" />
    </svg>
  );
}
