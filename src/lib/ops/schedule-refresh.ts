/**
 * Debounce unique pour le rafraîchissement Realtime (plusieurs canaux
 * peuvent se déclencher en même temps : live-sync + bar/cuisine).
 */

let timer: ReturnType<typeof setTimeout> | null = null;
let pendingWhileHidden = false;
let refreshFn: (() => void) | null = null;

export const OPS_REFRESH_DEBOUNCE_MS = 1200;

export function scheduleOpsRefresh(
  refresh: () => void,
  delayMs = OPS_REFRESH_DEBOUNCE_MS,
): void {
  refreshFn = refresh;

  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    pendingWhileHidden = true;
    return;
  }

  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => {
    timer = null;
    refreshFn?.();
  }, delayMs);
}

export function flushPendingOpsRefresh(): void {
  if (!pendingWhileHidden) return;
  pendingWhileHidden = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  refreshFn?.();
}

export function cancelScheduledOpsRefresh(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
