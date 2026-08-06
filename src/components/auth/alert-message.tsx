type AlertMessageProps = {
  message: string;
  tone?: "error" | "success";
};

export function AlertMessage({ message, tone = "error" }: AlertMessageProps) {
  const styles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-xl border px-4 py-3 text-sm ${styles}`}
    >
      {message}
    </div>
  );
}
