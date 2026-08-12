function isPublicHttpUrl(value: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\") || value.startsWith("file:")) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function getDesktopDownloadUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL?.trim();
  if (!url || !isPublicHttpUrl(url)) {
    return null;
  }
  return url;
}

export function getDesktopPublicVersion(): string {
  return (
    process.env.NEXT_PUBLIC_DESKTOP_APP_VERSION?.trim() ||
    process.env.npm_package_version?.trim() ||
    "0.1.0"
  );
}

export const FASOBAR_WHATSAPP = {
  e164: "22657537299",
  display: "+226 57 53 72 99",
  href: `https://wa.me/22657537299?text=${encodeURIComponent(
    "Bonjour, je souhaite en savoir plus sur FasoBar.",
  )}`,
} as const;

export const MARKETING_NAV = [
  { href: "/", label: "Accueil" },
  { href: "/fonctionnalites", label: "Fonctionnalités" },
  { href: "/solutions", label: "Solutions" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/telecharger", label: "Télécharger" },
  { href: "/aide", label: "Aide" },
  { href: "/contact", label: "Contact" },
] as const;

/** Exemples d’activités — FasoBar n’est pas limité à un métier. */
export const MARKETING_ACTIVITIES = [
  { id: "boutique", label: "Boutique" },
  { id: "quincaillerie", label: "Quincaillerie" },
  { id: "pharmacie", label: "Pharmacie" },
  { id: "pieces-detachees", label: "Pièces détachées" },
  { id: "restaurant", label: "Restaurant" },
  { id: "maquis", label: "Maquis" },
  { id: "bar", label: "Bar" },
  { id: "buvette", label: "Buvette" },
  { id: "autres", label: "Autres commerces" },
] as const;
