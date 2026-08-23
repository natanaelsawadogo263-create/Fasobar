import Link from "next/link";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { WhatsAppContact } from "@/components/marketing/whatsapp-contact";
import { FASOBAR_WHATSAPP } from "@/lib/marketing/config";
import { SOLUTION_SECTORS } from "@/lib/marketing/solutions";

export function MarketingFooter() {
  return (
    <footer className="border-t border-emerald-950/40 bg-[#07110e] text-emerald-50/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <FasoBarLogo size="sm" tone="dark" />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-emerald-100/70">
            Logiciel de gestion pour commerces et établissements — caisse,
            stock, produits et rapports, dans un seul outil.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300/90">
            Produit
          </p>
          <div className="mt-3 flex flex-col gap-2 text-[13px]">
            <FooterLink href="/fonctionnalites">Fonctionnalités</FooterLink>
            <FooterLink href="/tarifs">Tarifs</FooterLink>
            <FooterLink href="/telecharger">Télécharger</FooterLink>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300/90">
            Solutions
          </p>
          <div className="mt-3 flex flex-col gap-2 text-[13px]">
            {SOLUTION_SECTORS.map((sector) => (
              <FooterLink key={sector.slug} href={`/solutions/${sector.slug}`}>
                {sector.navLabel}
              </FooterLink>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300/90">
            Ressources
          </p>
          <div className="mt-3 flex flex-col gap-2 text-[13px]">
            <FooterLink href="/faq">FAQ</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
            <WhatsAppContact variant="link" />
            <p className="text-emerald-100/55">{FASOBAR_WHATSAPP.display}</p>
          </div>

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300/90">
            Légal
          </p>
          <div className="mt-3 flex flex-col gap-2 text-[13px]">
            <FooterLink href="/conditions-utilisation">
              Conditions d’utilisation
            </FooterLink>
            <FooterLink href="/politique-de-confidentialite">
              Confidentialité
            </FooterLink>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-[12px] text-emerald-100/45 sm:px-6">
          © {new Date().getFullYear()} FasoBar
        </p>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="transition hover:text-white">
      {children}
    </Link>
  );
}
