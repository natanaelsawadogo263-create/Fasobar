"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Bell,
  Beer,
  CircleDollarSign,
  PackageMinus,
  PackagePlus,
  ShoppingBag,
  Wallet,
} from "lucide-react";

import { markAdminNotificationsReadAction } from "@/app/(protected)/application/notifications/actions";
import {
  playFasoBarNotificationChime,
  unlockNotificationAudio,
} from "@/lib/admin/notification-chime";
import type {
  AdminNotificationItem,
  AdminNotificationKind,
} from "@/lib/admin/notification-types";
import { createClient } from "@/lib/supabase/client";

type AdminNotificationsBellProps = {
  establishmentId: string;
};

function kindIcon(kind: AdminNotificationItem["kind"]) {
  switch (kind) {
    case "SALE":
      return ShoppingBag;
    case "SUPPLY":
      return PackagePlus;
    case "LOSS":
      return PackageMinus;
    case "EXPENSE":
      return CircleDollarSign;
    case "BAR_SESSION_OPEN":
    case "BAR_SESSION_CLOSE":
      return Beer;
    default:
      return Wallet;
  }
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days} j`;
}

export function AdminNotificationsBell({
  establishmentId,
}: AdminNotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const knownIdsRef = useRef(new Set<string>());

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!establishmentId) return;

    let cancelled = false;
    const supabase = createClient();

    async function loadInitial() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: rows, error } = await supabase
        .from("admin_notifications")
        .select("id, kind, title, body, href, created_at")
        .eq("establishment_id", establishmentId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error || !rows || cancelled) return;

      const ids = rows.map((row) => row.id);
      const { data: reads } =
        ids.length > 0
          ? await supabase
              .from("admin_notification_reads")
              .select("notification_id")
              .eq("user_id", user.id)
              .in("notification_id", ids)
          : { data: [] as Array<{ notification_id: string }> };

      if (cancelled) return;

      const readIds = new Set(
        (reads ?? []).map((row) => String(row.notification_id)),
      );
      const nextItems: AdminNotificationItem[] = rows.map((row) => ({
        id: row.id,
        kind: (row.kind as AdminNotificationKind) ?? "SALE",
        title: row.title,
        body: row.body,
        href: row.href,
        createdAt: row.created_at,
        read: readIds.has(row.id),
      }));

      for (const item of nextItems) {
        knownIdsRef.current.add(item.id);
      }

      setItems((prev) => {
        const byId = new Map(nextItems.map((item) => [item.id, item]));
        for (const item of prev) {
          if (!byId.has(item.id)) {
            byId.set(item.id, item);
          }
        }
        const merged = [...byId.values()]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 40);
        queueMicrotask(() => {
          if (!cancelled) {
            setUnreadCount(merged.filter((item) => !item.read).length);
          }
        });
        return merged;
      });
    }

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [establishmentId]);

  // Unlock audio after first user gesture (browser autoplay policy).
  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Realtime: new activity → chime + badge.
  useEffect(() => {
    if (!establishmentId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`admin-notifications-chime:${establishmentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_notifications",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            kind?: string;
            title?: string;
            body?: string | null;
            href?: string | null;
            created_at?: string;
          };

          if (!row.id || knownIdsRef.current.has(row.id)) {
            return;
          }
          knownIdsRef.current.add(row.id);

          const nextItem: AdminNotificationItem = {
            id: row.id,
            kind: (row.kind as AdminNotificationKind) ?? "SALE",
            title: row.title ?? "Nouvelle activité",
            body: row.body ?? null,
            href: row.href ?? null,
            createdAt: row.created_at ?? new Date().toISOString(),
            read: false,
          };

          setItems((prev) => [nextItem, ...prev].slice(0, 40));
          if (!openRef.current) {
            setUnreadCount((count) => count + 1);
            void playFasoBarNotificationChime();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [establishmentId]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function markAllRead() {
    if (unreadCount === 0) return;

    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);

    startTransition(async () => {
      await markAdminNotificationsReadAction();
    });
  }

  function toggleOpen() {
    unlockNotificationAudio();
    const next = !open;
    setOpen(next);
    if (next) {
      markAllRead();
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        aria-label={
          unreadCount > 0
            ? `Notifications : ${unreadCount} non lues`
            : "Notifications"
        }
        aria-expanded={open}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10">
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
            <p className="text-[13px] font-semibold text-slate-900">
              Notifications
            </p>
            <span className="text-[11px] text-slate-400">
              {isPending ? "…" : unreadCount > 0 ? `${unreadCount} non lues` : "À jour"}
            </span>
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-slate-500">
                Aucune notification pour le moment.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => {
                  const Icon = kindIcon(item.kind);
                  const content = (
                    <>
                      <span
                        className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          item.read
                            ? "bg-slate-50 text-slate-400"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-[12.5px] leading-snug ${
                            item.read
                              ? "font-medium text-slate-600"
                              : "font-semibold text-slate-900"
                          }`}
                        >
                          {item.title}
                        </span>
                        {item.body ? (
                          <span className="mt-0.5 block truncate text-[11.5px] text-slate-500">
                            {item.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[10.5px] text-slate-400">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </span>
                      {!item.read ? (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      ) : null}
                    </>
                  );

                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="flex items-start gap-2.5 px-3.5 py-2.5 transition hover:bg-slate-50"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-2.5 px-3.5 py-2.5">
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
