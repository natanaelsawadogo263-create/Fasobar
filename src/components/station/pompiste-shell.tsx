"use client";

import { useEffect, useState, type ReactNode } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { PompisteSidebar } from "@/components/station/pompiste-sidebar";
import { PompisteTopbar } from "@/components/station/pompiste-topbar";
import type { NavItem } from "@/lib/navigation/space-navigation";
import { createClient } from "@/lib/supabase/client";

type PompisteSessionSummary = {
  hasOwnSession: boolean;
  sessionOpenedAt?: string;
  fuelPumpName?: string | null;
};

type PompisteShellProps = {
  establishmentName: string;
  navItems: NavItem[];
  children: ReactNode;
  pompisteName?: string;
  establishmentId?: string;
  userId?: string;
  initialSessionSummary?: PompisteSessionSummary;
};

const POMPISTE_PRIMARY = [
  "/application/station/pompiste/session",
  "/application/station/pompiste",
];

export function PompisteShell({
  establishmentName,
  navItems,
  children,
  pompisteName,
  establishmentId,
  userId,
  initialSessionSummary,
}: PompisteShellProps) {
  const [sessionSummary, setSessionSummary] = useState<PompisteSessionSummary>(
    () =>
      initialSessionSummary ?? {
        hasOwnSession: false,
      },
  );

  useEffect(() => {
    setSessionSummary(initialSessionSummary ?? { hasOwnSession: false });
  }, [initialSessionSummary]);

  useEffect(() => {
    if (!establishmentId || !userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`pompiste-session-${establishmentId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pump_sessions",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | {
                status?: string;
                opened_by?: string;
                opened_at?: string;
                fuel_pump_id?: string;
              }
            | undefined;

          if (!row || row.opened_by !== userId) return;

          if (row.status === "OPEN") {
            setSessionSummary((prev) => ({
              hasOwnSession: true,
              sessionOpenedAt: row.opened_at ?? prev.sessionOpenedAt,
              fuelPumpName: prev.fuelPumpName,
            }));
            return;
          }

          if (row.status === "CLOSED") {
            setSessionSummary({ hasOwnSession: false });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [establishmentId, userId]);

  return (
    <div className="pompiste-shell app-shell flex h-dvh w-full max-w-full overflow-hidden bg-[#f4f6f8]">
      <div className="hidden h-full shrink-0 md:flex">
        <PompisteSidebar navItems={navItems} establishmentName={establishmentName} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PompisteTopbar
          establishmentName={establishmentName}
          pompisteName={pompisteName}
          hasOwnSession={sessionSummary.hasOwnSession}
          sessionOpenedAt={sessionSummary.sessionOpenedAt}
          fuelPumpName={sessionSummary.fuelPumpName ?? null}
        />
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      <MobileNav items={navItems} primaryHrefs={POMPISTE_PRIMARY} tone="bar" />
    </div>
  );
}
