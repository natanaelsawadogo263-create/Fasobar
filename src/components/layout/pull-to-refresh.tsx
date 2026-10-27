"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/** Distance (px, après amortissement) à atteindre pour déclencher le rafraîchissement. */
const TRIGGER_DISTANCE = 70;
const MAX_DISTANCE = 110;
/** Amortissement du geste : le doigt parcourt deux fois la distance affichée. */
const RESISTANCE = 0.5;

/** Zones où le geste ne doit jamais rafraîchir (saisie, fenêtres ouvertes…). */
const IGNORED_TARGETS =
  'input, textarea, select, [contenteditable="true"], [role="dialog"], [aria-modal="true"], [data-no-pull-refresh]';

/** Vrai si la cible et tous ses conteneurs défilants sont tout en haut. */
function isAtTop(target: Element | null): boolean {
  if (window.scrollY > 0) return false;
  for (let node = target; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    const scrollable =
      (overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight;
    if (scrollable && node.scrollTop > 0) return false;
  }
  return true;
}

/**
 * Mobile : tirer vers le bas depuis le haut de l'écran recharge la page.
 * Les écrans de l'application défilent dans des conteneurs internes (et la PWA
 * est en mode standalone), donc le geste natif du navigateur ne fonctionne pas.
 */
export function PullToRefresh() {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const gesture = useRef<{ startX: number; startY: number; target: Element | null } | null>(null);
  const distanceRef = useRef(0);

  useEffect(() => {
    function update(value: number) {
      distanceRef.current = value;
      setDistance(value);
    }

    function onTouchStart(event: TouchEvent) {
      gesture.current = null;
      if (event.touches.length !== 1) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(IGNORED_TARGETS)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (!isAtTop(target)) return;
      const touch = event.touches[0];
      gesture.current = { startX: touch.clientX, startY: touch.clientY, target };
    }

    function onTouchMove(event: TouchEvent) {
      const current = gesture.current;
      if (!current) return;
      const touch = event.touches[0];
      const dy = touch.clientY - current.startY;
      const dx = touch.clientX - current.startX;
      // Geste vers le haut, horizontal, ou contenu qui a défilé entre-temps : on abandonne.
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || !isAtTop(current.target)) {
        gesture.current = null;
        update(0);
        return;
      }
      update(Math.min(dy * RESISTANCE, MAX_DISTANCE));
    }

    function onTouchEnd() {
      if (!gesture.current) return;
      gesture.current = null;
      if (distanceRef.current >= TRIGGER_DISTANCE) {
        setRefreshing(true);
        update(TRIGGER_DISTANCE);
        window.location.reload();
        return;
      }
      update(0);
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  if (distance <= 0 && !refreshing) return null;

  const progress = Math.min(distance / TRIGGER_DISTANCE, 1);
  const ready = progress >= 1;

  return (
    <div
      aria-hidden={!refreshing}
      role={refreshing ? "status" : undefined}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{ transform: `translateY(${distance - 44}px)` }}
    >
      <div
        className={`mt-[env(safe-area-inset-top)] flex h-10 w-10 items-center justify-center rounded-full border bg-white shadow-md transition-colors ${
          ready ? "border-emerald-200 text-emerald-600" : "border-slate-200 text-slate-400"
        }`}
        style={{ opacity: Math.max(progress, 0.3) }}
      >
        <RefreshCw
          className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        />
        {refreshing ? <span className="sr-only">Actualisation…</span> : null}
      </div>
    </div>
  );
}
