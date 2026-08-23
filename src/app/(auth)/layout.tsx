import type { Metadata } from "next";

import { AuthScrollShell } from "@/components/auth/auth-scroll-shell";

// Connexion, inscription, mot de passe oublié... — jamais indexables : ce
// sont des écrans applicatifs, pas du contenu destiné à Google.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthScrollShell>{children}</AuthScrollShell>;
}
