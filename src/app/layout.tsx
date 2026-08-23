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

export const metadata: Metadata = {
  title: {
    default: "FasoBar — Gestion des stocks et des ventes",
    template: "%s",
  },
  description:
    "FasoBar, logiciel de gestion des stocks et des ventes pour toute activité commerciale.",
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
