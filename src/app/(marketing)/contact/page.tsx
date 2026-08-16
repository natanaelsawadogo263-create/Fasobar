import type { Metadata } from "next";

import { MarketingContactPage } from "@/components/marketing/contact-page";
import { FASOBAR_WHATSAPP } from "@/lib/marketing/config";

export const metadata: Metadata = {
  title: "Contact — FasoBar",
  description: `Contacter FasoBar sur WhatsApp au ${FASOBAR_WHATSAPP.display}. Kit, abonnement, installation et aide.`,
};

export default function ContactPage() {
  return <MarketingContactPage />;
}
