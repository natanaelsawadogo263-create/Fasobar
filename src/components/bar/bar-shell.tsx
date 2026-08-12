"use client";

import { useEffect, useState, type ReactNode } from "react";

import { BarSidebar } from "@/components/bar/bar-sidebar";
import { BarTopbar } from "@/components/bar/bar-topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { NavItem } from "@/lib/navigation/space-navigation";
import { createClient } from "@/lib/supabase/client";

type BarShellProps = {
  establishmentName: string;
  navItems: NavItem[];
  children: ReactNode;
  managerName?: string;
  establishmentId?: string;
  userId?: string;
};

const BAR_PRIMARY = [
  "/application/bar",
  "/application/bar/commandes",
  "/application/bar/stock",
  "/application/bar/approvisionnements",
];

export function BarShell({
  establishmentName,
  navItems,
  children,
  managerName,
  establishmentId,
  userId,
}: BarShellProps) {
  const [hasOwnSession, setHasOwnSession] = useState(false);
  const [sessionOpenedAt, setSessionOpenedAt] = useState<string | undefined>();
  const [openSessionHolderName, setOpenSessionHolderName] = useState<string | null>(null);

  useEffect(() => {
    if (!establishmentId) return;
    let cancelled = false;
    const supabase = createClient();

    async function loadSession() {
      const { data } = await supabase
        .from("bar_sessions")
        .select(
          "opened_at, opened_by, profiles!bar_sessions_opened_by_fkey(full_name)",
        )
        .eq("establishment_id", establishmentId)
        .eq("status", "OPEN")
        .maybeSingle();

      if (cancelled) return;
      if (!data) {
        setHasOwnSession(false);
        setSessionOpenedAt(undefined);
        setOpenSessionHolderName(null);
        return;
      }

      const isOwn = Boolean(userId) && data.opened_by === userId;
      const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
      setHasOwnSession(isOwn);
      setSessionOpenedAt(data.opened_at);
      setOpenSessionHolderName(
        isOwn ? null : ((profile?.full_name as string | undefined) ?? null),
      );
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [establishmentId, userId]);

  return (
    <div className="bar-shell app-shell flex h-dvh w-full max-w-full overflow-hidden bg-[#f4f6f8]">
      <div className="hidden h-full shrink-0 md:flex">
        <BarSidebar navItems={navItems} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <BarTopbar
          establishmentName={establishmentName}
          managerName={managerName}
          hasOwnSession={hasOwnSession}
          sessionOpenedAt={sessionOpenedAt}
          openSessionHolderName={openSessionHolderName}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      <MobileNav items={navItems} primaryHrefs={BAR_PRIMARY} tone="bar" />
    </div>
  );
}
