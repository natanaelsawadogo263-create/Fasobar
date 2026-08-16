"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ComponentProps,
  type MouseEvent,
  type PointerEvent,
  useRef,
} from "react";

export const NAV_START_EVENT = "fasobar:nav-start";

export function startNavProgress(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAV_START_EVENT));
}

function hrefToString(href: ComponentProps<typeof Link>["href"]): string | null {
  if (typeof href === "string") return href;
  if (!href || typeof href !== "object") return null;
  const path = href.pathname ?? "";
  const search = href.search ?? "";
  const hash = href.hash ?? "";
  if (!path) return null;
  return `${path}${search}${hash}`;
}

function isModifiedClick(event: Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "button">): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function isInternalAppHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

type InstantLinkProps = ComponentProps<typeof Link>;

/**
 * Lien métier FasoBar : précharge au survol / toucher,
 * navigation dès pointerdown (pas d’attente du click).
 */
export function InstantLink({
  href,
  onClick,
  onPointerDown,
  onPointerEnter,
  onTouchStart,
  prefetch = true,
  replace,
  ...props
}: InstantLinkProps) {
  const router = useRouter();
  const started = useRef(false);
  const url = hrefToString(href);

  const prefetchHref = () => {
    if (!url || !isInternalAppHref(url)) return;
    try {
      router.prefetch(url);
    } catch {
      // ignore
    }
  };

  const navigate = () => {
    if (!url || !isInternalAppHref(url)) return;
    startNavProgress();
    if (replace) {
      router.replace(url);
    } else {
      router.push(url);
    }
  };

  const interceptPointer = (event: PointerEvent<HTMLAnchorElement>) => {
    onPointerDown?.(event);
    if (event.defaultPrevented) return;
    if (!url || !isInternalAppHref(url)) return;
    if (isModifiedClick(event)) return;
    prefetchHref();
    if (onClick) return;
    event.preventDefault();
    started.current = true;
    navigate();
  };

  const interceptClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (started.current) {
      event.preventDefault();
      started.current = false;
      onClick?.(event);
      return;
    }
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (!url || !isInternalAppHref(url)) return;
    if (isModifiedClick(event)) return;
    event.preventDefault();
    navigate();
  };

  return (
    <Link
      href={href}
      prefetch={prefetch}
      replace={replace}
      {...props}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        prefetchHref();
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        prefetchHref();
      }}
      onPointerDown={interceptPointer}
      onClick={interceptClick}
    />
  );
}
