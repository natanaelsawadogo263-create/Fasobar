import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ConnexionScreen } from "@/components/auth/connexion-screen";
import { MarketingHomePage } from "@/components/marketing/home-page";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { JsonLd } from "@/components/marketing/json-ld";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";
import { FASOBAR_WHATSAPP } from "@/lib/marketing/config";
import { buildPageMetadata, SITE_URL } from "@/lib/marketing/seo";
import { createClient } from "@/lib/supabase/server";

// Route racine (hors groupe (marketing) — cette page gère aussi la
// redirection post-connexion et le mode desktop) : la metadata et les
// données structurées ne s'appliquent qu'au rendu public ci-dessous.
export const metadata: Metadata = buildPageMetadata({
  path: "/",
  description:
    "FasoBar est l’application de gestion de stock, caisse et ventes pour les commerces du Burkina Faso : produits, approvisionnements, équipe et rapports. Pensée pour les commerçants du Burkina Faso et d’Afrique.",
});

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FasoBar",
  url: SITE_URL,
  logo: `${SITE_URL}/brand/fasobar-icon-512.png`,
  description:
    "FasoBar est l’application de gestion de stock et de caisse pour les commerces et établissements du Burkina Faso : produits, approvisionnements, équipe et rapports.",
  areaServed: "BF",
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

const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FasoBar",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Windows",
  url: SITE_URL,
  description:
    "Application de gestion de stock, de caisse et de ventes pour les commerces et établissements du Burkina Faso : produits, approvisionnements, équipe et rapports.",
  areaServed: "BF",
};

type HomePageProps = {
  searchParams?: Promise<{ error?: string; redirect?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const desktopMode = isDesktopServerRuntime();
  const cookieStore = await cookies();

  if (cookieStore.get("fb_pw_recovery")?.value === "1") {
    redirect("/nouveau-mot-de-passe");
  }

  const user = await getAuthenticatedUser();

  if (user) {
    if (desktopMode) {
      redirect(await resolvePostLoginRedirect(user.id));
    }

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.status === "INACTIVE") {
      await supabase.auth.signOut();
    } else {
      redirect(await resolvePostLoginRedirect(user.id));
    }
  }

  const authError =
    params?.error === "auth"
      ? "Le lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien."
      : null;

  if (desktopMode) {
    return <ConnexionScreen authError={authError} />;
  }

  return (
    <>
      <JsonLd data={ORGANIZATION_JSON_LD} />
      <JsonLd data={WEBSITE_JSON_LD} />
      <JsonLd data={SOFTWARE_APPLICATION_JSON_LD} />
      <MarketingShell>
        <MarketingHomePage />
      </MarketingShell>
    </>
  );
}
