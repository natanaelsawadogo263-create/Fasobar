"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";

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

  // This frame already carries its own headline, features and price baked
  // into the picture — overlaying the usual title/paragraph on top of it
  // makes the two texts collide. Fade that text block out while it's shown.
  const isOfferFrame = FRAMES[active].includes("offre-kit");

  return (
    <section className="relative isolate w-full shrink-0 bg-[#07110e] text-white">
      <div className="relative min-h-[540px] w-full sm:min-h-[520px] lg:aspect-[21/9] lg:min-h-[460px]">
        <div className="fb-banner-reel absolute inset-0" aria-hidden>
          {FRAMES.map((src, index) => (
            <Image
              key={src}
              src={src}
              alt=""
              fill
              sizes="100vw"
              priority={index === 0}
              className={`fb-banner-frame ${index === active ? "is-active" : ""}`}
            />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(7,17,14,0.78)_0%,rgba(7,17,14,0.35)_38%,transparent_65%)]" />

        <div className="relative z-10 flex h-full max-w-6xl flex-col justify-end gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:mx-auto lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div
          aria-hidden={isOfferFrame}
          className={`max-w-md transition-opacity duration-700 ease-out ${
            isOfferFrame ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <FasoBarLogo size="lg" tone="dark" />
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-amber-300">
            FasoBar · Tous commerces
          </p>
          <h1 className="mt-2 text-[28px] font-semibold leading-[1.12] tracking-tight sm:text-[40px] lg:text-[44px]">
            Le logiciel de gestion de votre commerce.
            <span className="block text-emerald-300">
              Stock, caisse et ventes, un seul outil.
            </span>
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-slate-200/85 sm:text-[15px]">
            Conçu pour les commerçants du Burkina Faso — alimentation,
            quincaillerie, station-service, restaurant, bar — et adapté aux
            commerces d’Afrique.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link
            href="/inscription/activite"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-[15px] font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400"
          >
            Créer mon établissement
          </Link>
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
