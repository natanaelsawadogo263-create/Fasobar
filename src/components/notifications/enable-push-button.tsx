"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

import {
  savePushSubscriptionAction,
  removePushSubscriptionAction,
} from "@/lib/notifications/push-subscription-actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function isIosNotInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    nav.standalone === true;
  return isIos && !isStandalone;
}

type Status = "checking" | "unsupported" | "ios-not-installed" | "denied" | "off" | "on";

export function EnablePushButton({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!isPushSupported()) {
        setStatus(isIosNotInstalled() ? "ios-not-installed" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setStatus(existing ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("off");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function activate() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;

    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setStatus("off");
        return;
      }

      const result = await savePushSubscriptionAction({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      });
      setStatus(result.ok ? "on" : "off");
    } catch {
      setStatus("off");
    } finally {
      setPending(false);
    }
  }

  async function deactivate() {
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await removePushSubscriptionAction(endpoint);
      }
      setStatus("off");
    } finally {
      setPending(false);
    }
  }

  if (status === "checking" || status === "unsupported") return null;

  if (status === "ios-not-installed") {
    return (
      <p
        className={`hidden max-w-[13rem] truncate text-[11px] text-slate-400 lg:block ${className}`}
        title="Sur iPhone, ajoute FasoBar à l'écran d'accueil pour recevoir les alertes même app fermée."
      >
        Ajoute FasoBar à l&apos;écran d&apos;accueil pour les alertes
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p
        className={`hidden max-w-[11rem] truncate text-[11px] text-slate-400 lg:block ${className}`}
        title="Notifications bloquées pour FasoBar — réactive-les dans les réglages du navigateur."
      >
        Alertes bloquées (réglages navigateur)
      </p>
    );
  }

  if (status === "on") {
    return (
      <button
        type="button"
        onClick={deactivate}
        disabled={pending}
        title="Alertes activées — cliquer pour désactiver"
        aria-label="Désactiver les alertes push sur cet appareil"
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[12px] font-semibold text-emerald-800 transition active:bg-emerald-100 disabled:opacity-60 md:h-8 ${className}`}
      >
        <BellRing className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Alertes activées</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={activate}
      disabled={pending}
      title="Recevoir une alerte même app fermée (téléphone verrouillé)"
      aria-label="Activer les alertes push sur cet appareil"
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 transition active:bg-slate-50 disabled:opacity-60 md:h-8 ${className}`}
    >
      <BellRing className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">
        {pending ? "Activation…" : "Activer les alertes"}
      </span>
    </button>
  );
}
