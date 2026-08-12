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
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" onClick={() => setOpen(false)}>
          <FasoBarLogo size="sm" tone="dark" />
        </Link>

        <nav
          className="hidden flex-1 items-center justify-center gap-1 lg:flex"
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

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <Link
            href="/connexion"
            className="rounded-lg px-3 py-2 text-[13px] font-semibold text-emerald-100/90 transition hover:bg-white/5 hover:text-white"
          >
            Se connecter
          </Link>
          <Link
            href="/inscription/activite"
            className="inline-flex h-9 items-center rounded-lg bg-emerald-500 px-3.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-400"
          >
            Créer mon établissement
          </Link>
        </div>

        <button
          type="button"
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg text-white lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-[#07110e] px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Navigation mobile">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-emerald-50 hover:bg-white/5"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/connexion"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/15 px-3 py-2.5 text-center text-[13px] font-semibold text-white"
            >
              Se connecter
            </Link>
            <Link
              href="/inscription/activite"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-emerald-500 px-3 py-2.5 text-center text-[13px] font-semibold text-white"
            >
              Créer mon établissement
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
