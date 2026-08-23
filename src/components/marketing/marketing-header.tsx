"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import { MARKETING_NAV } from "@/lib/marketing/config";

export function MarketingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07110e]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="min-w-0 shrink-0" onClick={() => setOpen(false)}>
          <span className="sm:hidden">
            <FasoBarLogo size="sm" tone="dark" markOnly />
          </span>
          <span className="hidden sm:inline-flex">
            <FasoBarLogo size="sm" tone="dark" />
          </span>
        </Link>

        <nav
          className="hidden flex-1 items-center justify-center gap-1 md:flex"
          aria-label="Navigation principale"
        >
          {MARKETING_NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-emerald-100/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          <Link
            href="/connexion"
            className="inline-flex h-11 min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-2.5 text-[13px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 sm:border-0 sm:bg-transparent sm:px-3 sm:hover:bg-white/5"
          >
            Se connecter
          </Link>
          <Link
            href="/inscription/activite"
            className="inline-flex h-11 min-h-11 shrink-0 items-center rounded-xl bg-emerald-500 px-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-400 sm:px-3.5"
          >
            <span className="sm:hidden">Commencer</span>
            <span className="hidden sm:inline">Créer mon établissement</span>
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-[#07110e] px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Navigation mobile">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-[15px] font-medium text-emerald-50 hover:bg-white/5"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
