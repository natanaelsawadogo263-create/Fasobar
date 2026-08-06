type FasoBarLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  stacked?: boolean;
  /** `dark` = wordmark clair (sidebar sombre) */
  tone?: "light" | "dark";
};

const SIZES = {
  sm: { mark: 28, word: "text-base", gap: "gap-2" },
  md: { mark: 36, word: "text-lg", gap: "gap-2.5" },
  lg: { mark: 48, word: "text-2xl sm:text-[1.75rem]", gap: "gap-3" },
} as const;

export function FasoBarLogo({
  size = "md",
  className = "",
  stacked = false,
  tone = "light",
}: FasoBarLogoProps) {
  const s = SIZES[size];
  const fasoClass = tone === "dark" ? "text-white" : "text-slate-900";
  const barClass = tone === "dark" ? "text-emerald-400" : "text-emerald-600";

  return (
    <div
      className={`inline-flex ${stacked ? "flex-col items-center" : "items-center"} ${s.gap} ${className}`}
    >
      <span
        className="relative flex shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-[0_10px_24px_-10px_rgba(5,150,105,0.85)] ring-1 ring-emerald-600/30"
        style={{ width: s.mark, height: s.mark }}
        aria-hidden
      >
        <svg
          viewBox="0 0 32 32"
          className="h-[58%] w-[58%] text-white"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9 6h14l-1.6 12.2A5 5 0 0 1 16.5 23h-1a5 5 0 0 1-4.9-4.8L9 6Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M11.2 11.5h9.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path d="M16 23v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M12.5 27.5h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>

      <span className={`font-semibold tracking-tight ${s.word} ${stacked ? "mt-0.5" : ""}`}>
        <span className={fasoClass}>Faso</span>
        <span className={barClass}>Bar</span>
      </span>
    </div>
  );
}
