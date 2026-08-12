import Link from "next/link";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { WhatsAppContact } from "@/components/marketing/whatsapp-contact";
import { MARKETING_ACTIVITIES } from "@/lib/marketing/config";

export function MarketingFooter() {
  return (
    <footer className="border-t border-emerald-950/40 bg-[#07110e] text-emerald-50/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <FasoBarLogo size="sm" tone="dark" />
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-emerald-100/70">
            Logiciel de gestion des stocks et des ventes.
          </p>
        </div>

        <FooterCol title="Produit">
          <FooterLink href="/fonctionnalites">Fonctionnalités</FooterLink>
          <FooterLink href="/tarifs">Tarifs</FooterLink>
          <FooterLink href="/telecharger">Télécharger</FooterLink>
        </FooterCol>

        <FooterCol title="Solutions">
          <FooterLink href="/solutions">Activités</FooterLink>
          {MARKETING_ACTIVITIES.slice(0, 6).map((item) => (
            <FooterLink key={item.id} href={`/solutions#${item.id}`}>
              {item.label}
            </FooterLink>
          ))}
        </FooterCol>

        <FooterCol title="Assistance">
          <FooterLink href="/aide">Aide</FooterLink>
          <FooterLink href="/faq">FAQ</FooterLink>
          <FooterLink href="/contact">Contact</FooterLink>
          <WhatsAppContact variant="link" />
        </FooterCol>

        <FooterCol title="Légal">
          <FooterLink href="/conditions-utilisation">
            Conditions d’utilisation
          </FooterLink>
          <FooterLink href="/politique-de-confidentialite">
            Politique de confidentialité
          </FooterLink>
        </FooterCol>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-[12px] text-emerald-100/45 sm:px-6">
          © {new Date().getFullYear()} FasoBar
        </p>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300/90">
        {title}
      </p>
      <div className="mt-3 flex flex-col gap-2 text-[13px]">{children}</div>
    </div>
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
