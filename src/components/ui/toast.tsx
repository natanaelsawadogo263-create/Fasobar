"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { toUserFacingError } from "@/lib/errors/user-facing";

export type ToastTone = "success" | "error" | "info" | "warning";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3500;

type ToastListener = (message: string, tone: ToastTone) => void;
const toastListeners = new Set<ToastListener>();

function publishToast(message: string, tone: ToastTone = "success") {
  const text = (tone === "error" ? toUserFacingError(message) : message).trim();
  if (!text) return;
  if (toastListeners.size > 0) {
    toastListeners.forEach((listener) => listener(text, tone));
    return;
  }
  // Dernier recours si aucun provider n’écoute encore (HMR / edge render).
  showEmergencyToast(text, tone);
}

function showEmergencyToast(message: string, tone: ToastTone) {
  if (typeof document === "undefined") return;
  const hostId = "fasobar-emergency-toast-host";
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement("div");
    host.id = hostId;
    host.className =
      "pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4";
    document.body.appendChild(host);
  }
  const styles = TONE_STYLES[tone];
  const card = document.createElement("div");
  card.className = `pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg shadow-slate-900/10 ${styles.shell}`;
  card.setAttribute("role", "status");
  card.innerHTML = `<p class="min-w-0 flex-1 font-medium leading-snug"></p>`;
  const p = card.querySelector("p");
  if (p) p.textContent = message;
  host.appendChild(card);
  window.setTimeout(() => {
    card.remove();
    if (host && host.childElementCount === 0) host.remove();
  }, AUTO_DISMISS_MS);
}

const TONE_STYLES: Record<ToastTone, { shell: string; close: string }> = {
  success: {
    shell: "border-emerald-200 bg-emerald-50 text-emerald-800",
    close: "text-emerald-600 hover:bg-emerald-100/80 hover:text-emerald-900",
  },
  error: {
    shell: "border-red-200 bg-red-50 text-red-800",
    close: "text-red-600 hover:bg-red-100/80 hover:text-red-900",
  },
  info: {
    shell: "border-slate-200 bg-white text-slate-800",
    close: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
  },
  warning: {
    shell: "border-amber-200 bg-amber-50 text-amber-950",
    close: "text-amber-700 hover:bg-amber-100/80 hover:text-amber-950",
  },
};

const fallbackToastApi: ToastContextValue = {
  show: publishToast,
  success: (message) => publishToast(message, "success"),
  error: (message) => publishToast(message, "error"),
  dismiss: () => undefined,
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const styles = TONE_STYLES[item.tone];

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg shadow-slate-900/10 ${styles.shell}`}
      style={{ animation: "fasobar-toast-in 180ms ease-out" }}
    >
      <p className="min-w-0 flex-1 font-medium leading-snug">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className={`-mr-1 -mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${styles.close}`}
        aria-label="Fermer la notification"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((message: string, tone: ToastTone = "success") => {
    const text = (tone === "error" ? toUserFacingError(message) : message).trim();
    if (!text) return;
    seq.current += 1;
    const id = `toast-${Date.now()}-${seq.current}`;
    setItems((current) => [...current.slice(-4), { id, message: text, tone }]);
  }, []);

  useEffect(() => {
    const listener: ToastListener = (message, tone) => show(message, tone);
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, [show]);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message) => show(message, "success"),
      error: (message) => show(message, "error"),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4"
              aria-live="polite"
              aria-relevant="additions"
            >
              {items.map((item) => (
                <ToastCard key={item.id} item={item} onDismiss={dismiss} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? fallbackToastApi;
}

export function useToastOptional(): ToastContextValue | null {
  return useContext(ToastContext);
}
