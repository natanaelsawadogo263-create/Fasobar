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

/**
 * Où l'utilisateur se trouve, pour lui donner les bonnes étapes d'installation.
 * - in-app : navigateur intégré (WhatsApp, Facebook…) qui ne sait pas installer ;
 * - ios-safari / ios-other : iPhone/iPad (installation manuelle uniquement) ;
 * - android : Android sans fenêtre d'installation automatique (menu ⋮) ;
 * - desktop : ordinateur.
 */
export type InstallEnvironment = "in-app" | "ios-safari" | "ios-other" | "android" | "desktop";

export function detectInstallEnvironment(): InstallEnvironment {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|TikTok|musical_ly|Messenger|GSA\//i.test(ua)) {
    return "in-app";
  }
  if (isIosDevice()) {
    return /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(ua) ? "ios-other" : "ios-safari";
  }
  if (/Android/i.test(ua)) {
    // WebView Android (applis intégrées non reconnues ci-dessus).
    return /; wv\)/.test(ua) ? "in-app" : "android";
  }
  return "desktop";
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
  | "manual-help"
  | "shortcut-download";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
