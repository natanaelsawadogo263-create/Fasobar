"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { FasoBarInstallButton } from "@/components/pwa/fasobar-install-button";

const FRAMES = [
  "/brand/banner/01-stock.png",
  "/brand/banner/02-caisse.png",
  "/brand/banner/00-offre-kit.png",
  "/brand/banner/03-imprimante.png",
  "/brand/banner/04-logo.png",
] as const;

const FRAME_MS = 5000;

export function MarketingVideoBanner() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % FRAMES.length);
    }, FRAME_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="relative isolate w-full shrink-0 bg-[#07110e] text-white">
      <div className="relative aspect-[16/9] w-full min-h-[56.25vw]">
        <div className="fb-banner-reel absolute inset-0" aria-hidden>
          {FRAMES.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              className={`fb-banner-frame ${index === active ? "is-active" : ""}`}
            />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(7,17,14,0.62)_0%,transparent_42%)]" />

        <div className="relative z-10 flex h-full max-w-6xl flex-col justify-end gap-4 px-4 py-6 sm:px-6 sm:py-10 lg:mx-auto lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-md">
          <FasoBarLogo size="lg" tone="dark" />
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-amber-300">
            FasoBar · Tous commerces
          </p>
          <h1 className="mt-2 text-[28px] font-semibold leading-[1.12] tracking-tight sm:text-[40px] lg:text-[44px]">
            Stock, caisse, tickets.
            <span className="block text-emerald-300">Un seul outil.</span>
          </h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/inscription/activite"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-[15px] font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400"
          >
            Créer mon établissement
          </Link>
          <FasoBarInstallButton
            variant="secondary"
            className="min-h-12 px-5 text-[15px] shadow-lg shadow-emerald-900/20"
          />
          <Link
            href="/contact"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 text-[15px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
          >
            Commander le kit
          </Link>
        </div>
        </div>
      </div>
    </section>
  );
}
