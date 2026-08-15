"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export const EXPAND_PANEL_CLASS =
  "fixed inset-0 z-[80] flex min-h-0 flex-col overflow-hidden rounded-none bg-white p-3 shadow-none ring-0 sm:p-4";

export function useExpandPanel() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);

  return {
    expanded,
    toggle: () => setExpanded((value) => !value),
  };
}

export function ExpandPanelButton({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={expanded ? "Réduire" : "Plein écran"}
      aria-label={expanded ? "Réduire" : "Agrandir"}
      aria-pressed={expanded}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 active:bg-slate-50 sm:h-8 sm:w-8 sm:hover:bg-slate-50"
    >
      {expanded ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </button>
  );
}
