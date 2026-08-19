"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

type OpeningStatusPollerProps = {
  enabled?: boolean;
};

export function OpeningStatusPoller({
  enabled = true,
}: OpeningStatusPollerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 20_000);
    return () => window.clearInterval(id);
  }, [enabled, router]);

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(() => {
          router.refresh();
        })
      }
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60 sm:min-h-11"
    >
      <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      Vérifier le statut
    </button>
  );
}
