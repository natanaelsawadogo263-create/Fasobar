import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/marketing/seo";

// robots.txt ne remplace pas noindex (voir les metadata `robots` des layouts
// (auth), (protected) et dev/) — les deux sont utilisés ensemble : robots.txt
// évite le crawl inutile de ces espaces, noindex garantit qu'ils ne
// finissent pas indexés même si un lien externe pointait dessus.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/application/",
        "/platform/",
        "/onboarding/",
        "/connexion",
        "/inscription",
        "/mot-de-passe-oublie",
        "/nouveau-mot-de-passe",
        "/premiere-connexion",
        "/attente-validation",
        "/invitation",
        "/abonnement",
        "/acces-refuse",
        "/acces-refuse-plateforme",
        "/acces-saas-bloque",
        "/acces-suspendu",
        "/dev/",
        "/api/",
        "/affiche",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
