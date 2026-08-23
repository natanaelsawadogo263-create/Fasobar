"use client";

import { InstantLink as Link } from "@/components/layout/instant-link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Bell,
  Beer,
  CircleDollarSign,
  ClipboardList,
  PackageMinus,
  PackagePlus,
  ShoppingBag,
  Wallet,
} from "lucide-react";

import { markAdminNotificationsReadAction } from "@/app/(protected)/application/notifications/actions";
import { useAdminNotificationsLive } from "@/hooks/use-admin-notifications-live";
import type { AdminNotificationItem } from "@/lib/admin/notification-types";

type AdminNotificationsBellProps = {
  establishmentId: string;
};

function kindIcon(kind: AdminNotificationItem["kind"]) {
  switch (kind) {
    case "SALE":
      return ShoppingBag;
    case "ORDER":
      return ClipboardList;
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
  const [isPending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const live = useAdminNotificationsLive(establishmentId);

  useEffect(() => {
    live.setOpen(open);
  }, [open, live.setOpen]);

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

  function toggleOpen() {
    // Débloque uniquement la lecture audio (aucun son ici) : le son automatique à
    // l'arrivée d'une notification en a besoin, mais ouvrir/fermer la cloche ne doit
    // plus jouer de son lui-même.
    live.unlock();
    const next = !open;
    setOpen(next);
    if (next && live.unreadCount > 0) {
      live.markAllReadLocal();
      startTransition(async () => {
        await markAdminNotificationsReadAction();
      });
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition active:bg-slate-50 md:h-8 md:w-8 md:rounded-full md:hover:bg-slate-50 md:hover:text-slate-700"
        aria-label={
          live.unreadCount > 0
            ? `Notifications : ${live.unreadCount} non lues`
            : "Notifications"
        }
        aria-expanded={open}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {live.unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {live.unreadCount > 9 ? "9+" : live.unreadCount}
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
              {isPending
                ? "…"
                : live.unreadCount > 0
                  ? `${live.unreadCount} non lues`
                  : "À jour"}
            </span>
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {live.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-slate-500">
                Aucune notification pour le moment.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {live.items.map((item) => {
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
