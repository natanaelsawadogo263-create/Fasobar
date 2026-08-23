import type { Metadata } from "next";
import { Download, MonitorSmartphone, Share, Smartphone } from "lucide-react";

import { FasoBarInstallButton } from "@/components/pwa/fasobar-install-button";
import { buildPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = buildPageMetadata({
  path: "/telecharger",
  title: "Installer l’application",
  description:
    "Installez FasoBar sur votre PC, tablette ou téléphone en un raccourci — accédez à votre caisse en un clic, sans passer par le navigateur.",
});

export default function TelechargerPage() {
  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
          <Download className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
          Installer FasoBar sur votre appareil
        </h1>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <FasoBarInstallButton variant="primary" hideWhenInstalled={false} />
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <InstallCard
            icon={MonitorSmartphone}
            title="PC Windows"
            body="Chrome ou Edge propose « Installer ». Sinon, un fichier raccourci .url est téléchargé."
          />
          <InstallCard
            icon={Smartphone}
            title="Android"
            body="Le bouton ouvre l’installation native de l’application web (PWA)."
          />
          <InstallCard
            icon={Share}
            title="iPhone / iPad"
            body="Safari → Partager → Sur l’écran d’accueil → Ajouter."
          />
        </div>

        <p className="mt-8 text-[12px] text-slate-500">
          Le raccourci ouvre directement la page de connexion FasoBar.
        </p>
      </div>
    </section>
  );
}

function InstallCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Download;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-[#f7f8f6] p-5">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-800 ring-1 ring-slate-200">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="mt-3 text-[15px] font-semibold text-slate-900">{title}</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
        {body}
      </p>
    </article>
  );
}
