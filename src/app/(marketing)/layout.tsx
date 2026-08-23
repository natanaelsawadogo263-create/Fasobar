import type { Metadata } from "next";
import type { ReactNode } from "react";

import { JsonLd } from "@/components/marketing/json-ld";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { FASOBAR_WHATSAPP } from "@/lib/marketing/config";
import { SITE_URL } from "@/lib/marketing/seo";

// Toutes les pages publiques du site vitrine — explicitement indexables
// (comportement par défaut, mais déclaré ici pour que ce soit sans ambiguïté).
export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
};

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FasoBar",
  url: SITE_URL,
  logo: `${SITE_URL}/brand/fasobar-icon-512.png`,
  description:
    "FasoBar est un logiciel de gestion pour commerces et établissements : caisse, stock, produits, approvisionnements, équipe et rapports.",
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: `+${FASOBAR_WHATSAPP.e164}`,
      areaServed: "BF",
      availableLanguage: ["fr"],
    },
  ],
};

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "FasoBar",
  url: SITE_URL,
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd data={ORGANIZATION_JSON_LD} />
      <JsonLd data={WEBSITE_JSON_LD} />
      <MarketingShell>{children}</MarketingShell>
    </>
  );
}
