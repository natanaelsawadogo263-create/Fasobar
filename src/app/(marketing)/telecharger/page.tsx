import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/marketing/page-hero";
import {
  getDesktopDownloadUrl,
  getDesktopPublicVersion,
} from "@/lib/marketing/config";

export const metadata: Metadata = {
  title: "Télécharger — FasoBar",
  description: "Téléchargez FasoBar Desktop pour Windows.",
};

export default function TelechargerPage() {
  const downloadUrl = getDesktopDownloadUrl();
  const version = getDesktopPublicVersion();

  return (
    <>
      <PageHero
        kicker="Télécharger"
        title="FasoBar pour Windows."
        subtitle="L’application Windows pour les postes de travail."
      />
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
            Windows
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            FasoBar Desktop
          </h2>
          <p className="mt-2 text-[14px] text-slate-600">
            Version actuelle : <span className="font-semibold">{version}</span>
          </p>
          {downloadUrl ? (
            <a
              href={downloadUrl}
              className="mt-6 inline-flex h-11 items-center rounded-xl bg-emerald-700 px-5 text-[14px] font-semibold text-white hover:bg-emerald-600"
            >
              Télécharger FasoBar
            </a>
          ) : (
            <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-950">
              L’installateur public n’est pas encore publié. Configurez{" "}
              <code className="rounded bg-white px-1 text-[12px]">
                NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL
              </code>{" "}
              pour activer le bouton de téléchargement.
            </p>
          )}
        </article>

        <article className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-[16px] font-semibold text-slate-900">
            Nouvelle version
          </h3>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
            Notes de version : elles seront publiées ici dès la mise en ligne
            officielle de l’installateur FasoBar.
          </p>
        </article>

        <p className="mt-8 text-[14px] text-slate-600">
          Pas encore d’espace ?{" "}
          <Link href="/inscription" className="font-semibold text-emerald-800 hover:underline">
            Créer mon établissement
          </Link>
        </p>
      </section>
    </>
  );
}
