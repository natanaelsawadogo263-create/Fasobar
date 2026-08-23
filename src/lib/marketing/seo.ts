import type { Metadata } from "next";

export const SITE_URL = "https://fasobar.com";

/**
 * Image OG/Twitter par défaut (photo réelle d'une caisse FasoBar en usage).
 * Next.js ne fusionne PAS les champs imbriqués (openGraph, twitter) entre
 * layout et page : dès qu'une page redéfinit `openGraph`, elle doit
 * réinclure `images` elle-même sous peine de perdre celle du layout racine.
 */
const DEFAULT_OG_IMAGE = {
  url: "/og/fasobar-og.jpg",
  width: 1200,
  height: 630,
  alt: "FasoBar — logiciel de gestion, caisse et stock pour commerces",
};

type PageMetadataInput = {
  /** Chemin absolu depuis la racine, ex. "/tarifs". "/" pour l'accueil. */
  path: string;
  /**
   * Titre de la page — le suffixe « — FasoBar » est ajouté automatiquement
   * par le template du layout racine, ne pas le répéter ici. Omettre pour
   * l'accueil : `title.default` du layout racine est déjà le titre SEO
   * final voulu, verbatim (le template ne s'applique pas au défaut).
   */
  title?: string;
  description: string;
  /** Retire la page des index (pages utilitaires, redirections...). */
  noindex?: boolean;
};

/**
 * Construit une metadata de page publique cohérente : canonical +
 * Open Graph + Twitter, tous basés sur le domaine canonique fasobar.com.
 */
export function buildPageMetadata({
  path,
  title,
  description,
  noindex = false,
}: PageMetadataInput): Metadata {
  const url = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
  const ogTitle = title ?? "FasoBar — Logiciel de gestion, caisse et stock pour commerces";

  return {
    ...(title ? { title } : null),
    description,
    alternates: {
      canonical: path,
    },
    ...(noindex
      ? { robots: { index: false, follow: false } }
      : null),
    openGraph: {
      type: "website",
      siteName: "FasoBar",
      locale: "fr_FR",
      title: ogTitle,
      description,
      url,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}
