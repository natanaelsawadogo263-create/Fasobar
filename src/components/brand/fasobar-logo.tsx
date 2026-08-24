export const FASOBAR_LOGO_SRC = "/brand/fasobar-logo.png";
export const FASOBAR_LOGO_ON_DARK_SRC = "/brand/fasobar-logo-on-dark.png";

type FasoBarLogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  stacked?: boolean;
  /** `dark` = fond sombre (header, sidebar) — le pictogramme s’éclaircit */
  tone?: "light" | "dark";
  markOnly?: boolean;
  /** Agrandit uniquement le pictogramme (px), sans toucher à la taille du texte du preset `size`. */
  markSize?: number;
};

const SIZES = {
  sm: { mark: 32, word: "text-base", gap: "gap-2" },
  md: { mark: 40, word: "text-lg", gap: "gap-2.5" },
  lg: { mark: 52, word: "text-2xl sm:text-[1.75rem]", gap: "gap-3" },
  xl: { mark: 88, word: "text-3xl", gap: "gap-3" },
} as const;

export function FasoBarLogo({
  size = "md",
  className = "",
  stacked = false,
  tone = "light",
  markOnly = false,
  markSize,
}: FasoBarLogoProps) {
  const s = SIZES[size];
  const mark = markSize ?? s.mark;
  const onDark = tone === "dark";
  const fasoClass = onDark ? "text-white" : "text-slate-900";
  const barClass = onDark ? "text-emerald-400" : "text-emerald-700";

  return (
    <div
      className={`inline-flex ${stacked ? "flex-col items-center" : "items-center"} ${s.gap} ${className}`}
    >
      <img
        src={onDark ? FASOBAR_LOGO_ON_DARK_SRC : FASOBAR_LOGO_SRC}
        alt={markOnly ? "FasoBar" : ""}
        width={mark}
        height={mark}
        className="shrink-0 bg-transparent object-contain"
        decoding="async"
        aria-hidden={markOnly ? undefined : true}
      />
      {markOnly ? null : (
        <span className={`font-semibold tracking-tight ${s.word} ${stacked ? "mt-0.5" : ""}`}>
          <span className={fasoClass}>Faso</span>
          <span className={barClass}>Bar</span>
        </span>
      )}
    </div>
  );
}
