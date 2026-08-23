import type { Metadata } from "next";

// Tout l'espace applicatif (caisse, admin, plateforme, onboarding...) — jamais
// indexable : ce sont des écrans internes, protégés par authentification.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Auth déjà couverte par requireWorkspaceContext / pages enfants (cache React).
  // Évite un getUser() sérialisé avant chaque navigation /application.
  return <>{children}</>;
}
