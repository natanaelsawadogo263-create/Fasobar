import type { Metadata } from "next";

import { MarketingContactPage } from "@/components/marketing/contact-page";
import { FASOBAR_WHATSAPP } from "@/lib/marketing/config";
import { buildPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = buildPageMetadata({
  path: "/contact",
  title: "Contact",
  description: `Contactez FasoBar sur WhatsApp au ${FASOBAR_WHATSAPP.display} pour le kit, l’abonnement, l’installation ou toute question.`,
});

export default function ContactPage() {
  return <MarketingContactPage />;
}
