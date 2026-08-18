const START_PATH = "/connexion";

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function downloadFasoBarUrlShortcut(origin?: string) {
  if (typeof window === "undefined") return;
  const base = origin ?? window.location.origin;
  const target = `${base}${START_PATH}`;
  const content = `[InternetShortcut]\r\nURL=${target}\r\nIconFile=${base}/brand/fasobar-logo.png\r\nIconIndex=0\r\nHotKey=0\r\n`;
  const blob = new Blob([content], { type: "application/internet-shortcut" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "FasoBar.url";
  anchor.click();
  URL.revokeObjectURL(href);
}

export type FasoBarInstallOutcome =
  | "accepted"
  | "dismissed"
  | "already-installed"
  | "ios-help"
  | "shortcut-download";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
