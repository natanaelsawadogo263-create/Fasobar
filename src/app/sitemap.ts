import type { MetadataRoute } from "next";

import { SOLUTION_SECTORS } from "@/lib/marketing/solutions";
import { SITE_URL } from "@/lib/marketing/seo";

// Uniquement les pages publiques réellement indexables. Jamais : application,
// platform, connexion, onboarding, pages dynamiques privées, pages dev,
// /affiche (outil interne, noindex) ou /aide (simple redirection).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/gestion-de-stock-burkina-faso`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/fonctionnalites`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/solutions`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/tarifs`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/telecharger`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/conditions-utilisation`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/politique-de-confidentialite`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const solutionPages: MetadataRoute.Sitemap = SOLUTION_SECTORS.map((sector) => ({
    url: `${SITE_URL}/solutions/${sector.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...solutionPages];
}
