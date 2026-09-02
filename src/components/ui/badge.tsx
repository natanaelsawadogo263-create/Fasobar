import type { ReactNode } from "react";

/**
 * Purely informational status/tag pill — never put this inside a
 * <button>/<Link> and never give it a border or an active: state.
 * Deliberately styled to look nothing like ActionButton (which is always
 * bordered) so a glance can tell "label" from "tappable" apart.
 */
type BadgeTone =
  | "neutral"
  | "emerald"
  | "amber"
  | "red"
  | "sky"
  | "orange";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  emerald: "bg-emerald-50 text-emerald-800",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  sky: "bg-sky-50 text-sky-800",
  orange: "bg-orange-50 text-orange-800",
};

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

export function Badge({ children, tone = "neutral", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
