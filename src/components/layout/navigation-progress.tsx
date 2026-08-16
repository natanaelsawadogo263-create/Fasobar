"use client";

import { NAV_START_EVENT } from "@/components/layout/instant-link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barre fine en haut pendant une navigation client — feedback immédiat
 * sans skeleton plein écran qui donne l’impression de lenteur.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const first = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const begin = () => {
      setVisible(true);
      setWidth(22);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    window.addEventListener(NAV_START_EVENT, begin);
    return () => window.removeEventListener(NAV_START_EVENT, begin);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }

    setVisible(true);
    setWidth(18);

    const tick1 = setTimeout(() => setWidth(55), 80);
    const tick2 = setTimeout(() => setWidth(78), 220);

    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setWidth(100);
      setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 160);
    }, 280);

    return () => {
      clearTimeout(tick1);
      clearTimeout(tick2);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px] bg-transparent"
      aria-hidden
    >
      <div
        className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.55)] transition-[width] duration-200 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
