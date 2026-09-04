import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AuthEmailLinkHandler } from "@/components/auth/auth-email-link-handler";
import { PwaServiceWorkerRegister } from "@/components/pwa/pwa-service-worker-register";
import { ToastProvider } from "@/components/ui/toast";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://fasobar.com";
const SITE_TITLE =
  "FasoBar — Application de gestion de stock et caisse au Burkina Faso";
const SITE_DESCRIPTION =
  "FasoBar est l'application de gestion de stock, caisse et ventes pour les commerces du Burkina Faso : produits, approvisionnements, équipe et rapports, dans un seul outil.";
const DEFAULT_OG_IMAGE = {
  url: "/og/fasobar-og.jpg",
  width: 1200,
  height: 630,
  alt: "FasoBar — application de gestion de stock et caisse au Burkina Faso",
};

export const metadata: Metadata = {
  // Base absolue pour résoudre canonical, Open Graph et Twitter — domaine
  // canonique officiel, jamais www.fasobar.com.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — FasoBar",
  },
  description: SITE_DESCRIPTION,
  applicationName: "FasoBar",
  keywords: [
    "gestion de stock",
    "application de gestion de stock",
    "logiciel de gestion de stock Burkina Faso",
    "logiciel de caisse Burkina Faso",
    "gestion de stock Ouagadougou",
  ],
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "FasoBar",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "fr_FR",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
  // Le favicon/icône Apple viennent des fichiers app/icon.png et
  // app/apple-icon.png (convention Next.js) — ne pas les redéclarer ici avec
  // un autre visuel, sinon on obtient une icône différente de celle utilisée
  // ailleurs (ex. le raccourci PWA défini dans manifest.ts).
  appleWebApp: {
    capable: true,
    title: "FasoBar",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ToastProvider>
          <AuthEmailLinkHandler />
          <PwaServiceWorkerRegister />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
