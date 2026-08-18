export const FASOBAR_WHATSAPP = {
  e164: "22657537299",
  display: "+226 57 53 72 99",
  href: `https://wa.me/22657537299?text=${encodeURIComponent(
    "Bonjour, je souhaite en savoir plus sur FasoBar.",
  )}`,
} as const;

export function whatsappHref(message: string): string {
  return `https://wa.me/${FASOBAR_WHATSAPP.e164}?text=${encodeURIComponent(message)}`;
}

export const MARKETING_NAV = [
  { href: "/", label: "Accueil" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/telecharger", label: "Installer" },
  { href: "/contact", label: "Contact" },
] as const;
