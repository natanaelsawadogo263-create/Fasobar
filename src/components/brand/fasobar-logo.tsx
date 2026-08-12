export const FASOBAR_LOGO_SRC = "/brand/fasobar-logo.png";

type FasoBarLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  stacked?: boolean;
  /** `dark` = wordmark clair (sidebar sombre) */
  tone?: "light" | "dark";
  markOnly?: boolean;
};

const SIZES = {
  sm: { mark: 32, word: "text-base", gap: "gap-2" },
  md: { mark: 40, word: "text-lg", gap: "gap-2.5" },
  lg: { mark: 52, word: "text-2xl sm:text-[1.75rem]", gap: "gap-3" },
} as const;

export function FasoBarLogo({
  size = "md",
  className = "",
  stacked = false,
  tone = "light",
  markOnly = false,
}: FasoBarLogoProps) {
  const s = SIZES[size];
  const fasoClass = tone === "dark" ? "text-white" : "text-slate-900";
  const barClass = tone === "dark" ? "text-emerald-400" : "text-emerald-700";

  return (
    <div
      className={`inline-flex ${stacked ? "flex-col items-center" : "items-center"} ${s.gap} ${className}`}
    >
      <img
        src={FASOBAR_LOGO_SRC}
        alt={markOnly ? "FasoBar" : ""}
        width={s.mark}
        height={s.mark}
        className="shrink-0 rounded-lg bg-white object-contain"
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
