import type { ComponentType } from "react";

/**
 * Shared compact row action button — always bordered + filled + paired
 * hover/active states, so it never gets confused with a plain Badge (which
 * never has a border). `label` is required and always used as the
 * accessible name (aria-label + title), even when compact/icon-only.
 *
 * size "sm" (default) = 32px, label hidden below xl — for desktop table
 * rows where space is tight. size "md" = 40px with the label always
 * visible — for mobile-friendly card/list rows.
 */
type ActionButtonSize = "sm" | "md";
type ActionButtonTone = "default" | "danger";

type ActionButtonProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  compact?: boolean;
  size?: ActionButtonSize;
  tone?: ActionButtonTone;
  disabled?: boolean;
  className?: string;
};

const TONE_STYLES: Record<ActionButtonTone, string> = {
  default:
    "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 active:border-emerald-200 active:bg-emerald-50 active:text-emerald-800",
  danger:
    "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 active:border-red-200 active:bg-red-50 active:text-red-700",
};

const SIZE_STYLES: Record<
  ActionButtonSize,
  { button: string; withLabel: string; compact: string; icon: string; labelClass: string }
> = {
  sm: {
    button: "h-8",
    withLabel: "gap-1 px-2 text-[11px]",
    compact: "w-8",
    icon: "h-3.5 w-3.5",
    labelClass: "hidden xl:inline",
  },
  md: {
    button: "h-10",
    withLabel: "gap-1.5 px-3 text-[12px]",
    compact: "w-10",
    icon: "h-4 w-4",
    labelClass: "inline",
  },
};

export function ActionButton({
  icon: Icon,
  label,
  onClick,
  compact = false,
  size = "sm",
  tone = "default",
  disabled = false,
  className = "",
}: ActionButtonProps) {
  const s = SIZE_STYLES[size];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-md border font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${TONE_STYLES[tone]} ${s.button} ${
        compact ? s.compact : s.withLabel
      } ${className}`}
    >
      <Icon className={`${s.icon} shrink-0`} />
      {!compact ? <span className={s.labelClass}>{label}</span> : null}
    </button>
  );
}
