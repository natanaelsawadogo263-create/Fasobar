import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  BrowserWindow,
  app,
  shell,
  type BrowserWindowConstructorOptions,
} from "electron";

import type { DesktopConfig } from "../shared/config-schema";
import { isNavigationAllowed } from "./allowed-origins";

let mainWindow: BrowserWindow | null = null;

function preloadPath(): string {
  return path.join(__dirname, "preload.js");
}

/**
 * Absolute filesystem path to a packaged/dev renderer HTML file.
 * Never concatenate into file:/// manually — use pathToFileURL.
 */
export function resolveRendererHtmlPath(file: string): string {
  const absolute = app.isPackaged
    ? path.resolve(path.join(process.resourcesPath, "renderer", file))
    : path.resolve(path.join(app.getAppPath(), "desktop", "renderer", file));
  return absolute;
}

function iconPath(): string | undefined {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, "assets", "icon.ico"),
        path.join(path.dirname(app.getPath("exe")), "resources", "assets", "icon.ico"),
      ]
    : [
        path.join(app.getAppPath(), "desktop", "assets", "icon.ico"),
        path.join(app.getAppPath(), "build", "icon.ico"),
      ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function logWindowError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[FasoBar][${scope}] ${message}`);
}

/**
 * Load a local HTML file via a correctly encoded file:// URL.
 *
 * On Windows, Electron's loadFile + absolute paths can produce invalid URLs
 * like file:///C:\Users\... (backslashes) → ERR_FAILED (-2).
 * pathToFileURL always emits file:///C:/Users/...
 */
export async function loadRendererHtml(
  win: BrowserWindow,
  file: string,
  options?: { query?: Record<string, string> },
): Promise<void> {
  const absolute = resolveRendererHtmlPath(file);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Fichier renderer introuvable: ${absolute}`);
  }

  const fileUrl = pathToFileURL(absolute);
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      fileUrl.searchParams.set(key, value);
    }
  }

  await win.loadURL(fileUrl.toString());
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createMainWindow(options?: {
  show?: boolean;
}): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  const windowOptions: BrowserWindowConstructorOptions = {
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: options?.show ?? false,
    title: "FasoBar",
    icon: iconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  };

  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function attachNavigationGuard(
  win: BrowserWindow,
  getConfig: () => DesktopConfig | null,
): void {
  win.webContents.on("will-navigate", (event, url) => {
    if (!isNavigationAllowed(url, getConfig())) {
      event.preventDefault();
    }
  });
}

export async function loadSplash(win: BrowserWindow): Promise<void> {
  try {
    await loadRendererHtml(win, "splash.html");
  } catch (error) {
    logWindowError("splash", error);
    // Splash is non-critical — caller continues startup.
  }
}

export async function loadSetup(win: BrowserWindow): Promise<void> {
  try {
    await loadRendererHtml(win, "setup.html");
  } catch (error) {
    logWindowError("setup", error);
    throw error;
  }
}

export async function loadErrorPage(
  win: BrowserWindow,
  message: string,
): Promise<void> {
  try {
    await loadRendererHtml(win, "error.html", {
      query: { message },
    });
  } catch (error) {
    logWindowError("error-page", error);
    // Last-resort blank page with message — avoid unhandled rejection.
    try {
      await win.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          `<!doctype html><meta charset="utf-8"><title>FasoBar</title><p>${message}</p>`,
        )}`,
      );
    } catch (fallbackError) {
      logWindowError("error-page-fallback", fallbackError);
    }
  }
}

export async function loadAppUrl(
  win: BrowserWindow,
  url: string,
): Promise<void> {
  try {
    await win.loadURL(url);
  } catch (error) {
    logWindowError("app-url", error);
    throw error;
  }
}

export function showAndFocusMainWindow(): void {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
