import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  clipboard,
} from "electron";
import started from "electron-squirrel-startup";

import { z } from "zod";

import {
  createDefaultConfig,
  readDesktopConfig,
  resetDesktopConfig,
  writeDesktopConfig,
} from "./runtime-config";
import { LocalNextServer } from "./local-server";
import { buildLanServerUrl, isPortAvailable } from "./network";
import { probeFasoBarHealth } from "./health-probe";
import {
  attachNavigationGuard,
  createMainWindow,
  getMainWindow,
  loadAppUrl,
  loadErrorPage,
  loadSetup,
  loadSplash,
  showAndFocusMainWindow,
} from "./windows";
import { createAppTray, destroyTray } from "./tray";
import {
  normalizeServerUrl,
  serverUrlSchema,
} from "../shared/config-schema";
import type { DesktopConfig } from "../shared/config-schema";
import { DEFAULT_SERVER_PORT } from "../shared/constants";
import type { InstallationMode } from "../shared/constants";

/** Stable Windows AppUserModelID for taskbar / notifications / shortcuts. */
app.setAppUserModelId("com.fasobar.desktop");

if (started) {
  app.quit();
}

const APP_VERSION = app.getVersion();

let desktopConfig: DesktopConfig | null = null;
let localServer: LocalNextServer | null = null;
let isQuitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showAndFocusMainWindow();
  });
}

function getConfig(): DesktopConfig | null {
  return desktopConfig;
}

async function ensureServerRunning(config: DesktopConfig): Promise<void> {
  if (config.installationMode !== "SERVEUR_CAISSE") {
    return;
  }

  const available = await isPortAvailable(config.serverPort);
  if (!available && (!localServer || localServer.getStatus() !== "running")) {
    throw new Error(
      `Le port ${config.serverPort} est déjà utilisé. Fermez l’autre application ou changez le port.`,
    );
  }

  if (!localServer) {
    localServer = new LocalNextServer({
      port: config.serverPort,
      installationId: config.installationId,
      appVersion: config.appVersion || APP_VERSION,
    });
  }

  if (localServer.getStatus() !== "running") {
    await localServer.start();
  }
}

async function openConfiguredApp(config: DesktopConfig): Promise<void> {
  const win = createMainWindow({ show: true });
  attachNavigationGuard(win, getConfig);

  try {
    await loadSplash(win);
  } catch (error) {
    console.error("[FasoBar][open] splash failed (continuing)", error);
  }

  win.maximize();
  win.show();

  if (config.installationMode === "SERVEUR_CAISSE") {
    try {
      await ensureServerRunning(config);
    } catch (error) {
      await loadErrorPage(
        win,
        error instanceof Error ? error.message : "Démarrage serveur impossible.",
      );
      return;
    }

    const localUrl = `http://127.0.0.1:${config.serverPort}`;
    const health = await probeFasoBarHealth(localUrl, 15000);
    if (!health.ok) {
      await loadErrorPage(win, health.error);
      return;
    }

    createAppTray(win, {
      getServerStatus: () => localServer?.getStatus() ?? "stopped",
      getLanAddress: () => buildLanServerUrl(config.serverPort),
      getLocalAddress: () => localUrl,
      onRestartServer: async () => {
        await localServer?.restart();
      },
      onQuit: async () => {
        isQuitting = true;
        await localServer?.stop();
        destroyTray();
        app.quit();
      },
    });

    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
    await loadAppUrl(win, localUrl);

    win.removeAllListeners("close");
    win.on("close", (event) => {
      if (isQuitting) return;
      event.preventDefault();
      win.hide();
    });
    return;
  }

  if (!config.serverUrl) {
    await loadSetup(win);
    return;
  }

  const health = await probeFasoBarHealth(config.serverUrl);
  if (!health.ok) {
    await loadErrorPage(win, health.error);
    return;
  }

  await loadAppUrl(win, config.serverUrl);
}

function registerIpc(): void {
  ipcMain.handle("desktop:get-state", () => {
    const lan =
      desktopConfig?.installationMode === "SERVEUR_CAISSE"
        ? buildLanServerUrl(desktopConfig.serverPort)
        : null;
    return {
      config: desktopConfig,
      version: APP_VERSION,
      lanAddress: lan,
      localAddress: desktopConfig
        ? `http://127.0.0.1:${desktopConfig.serverPort}`
        : `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
      serverStatus: localServer?.getStatus() ?? "stopped",
    };
  });

  ipcMain.handle(
    "desktop:complete-setup",
    async (
      _event,
      payload: { mode: InstallationMode; serverUrl?: string },
    ) => {
      const modeSchema = z.enum(["SERVEUR_CAISSE", "POSTE_TRAVAIL"]);
      const mode = modeSchema.parse(payload.mode);

      const config = createDefaultConfig(mode, APP_VERSION);

      if (mode === "POSTE_TRAVAIL") {
        const url = normalizeServerUrl(payload.serverUrl ?? "");
        const health = await probeFasoBarHealth(url);
        if (!health.ok) {
          return { ok: false as const, error: health.error };
        }
        config.serverUrl = url;
      } else {
        const available = await isPortAvailable(config.serverPort);
        if (!available) {
          return {
            ok: false as const,
            error: `Le port ${config.serverPort} est occupé sur cet ordinateur.`,
          };
        }
        config.serverUrl = `http://127.0.0.1:${config.serverPort}`;
      }

      writeDesktopConfig(config);
      desktopConfig = config;

      await openConfiguredApp(config);
      return { ok: true as const };
    },
  );

  ipcMain.handle("desktop:retry-connection", async () => {
    if (!desktopConfig) {
      const win = getMainWindow() ?? createMainWindow({ show: true });
      await loadSetup(win);
      return { ok: false as const, error: "Configuration manquante." };
    }
    await openConfiguredApp(desktopConfig);
    return { ok: true as const };
  });

  ipcMain.handle(
    "desktop:update-server-url",
    async (_event, serverUrl: string) => {
      if (
        !desktopConfig ||
        desktopConfig.installationMode !== "POSTE_TRAVAIL"
      ) {
        return {
          ok: false as const,
          error: "Action réservée au poste de travail.",
        };
      }
      try {
        const url = normalizeServerUrl(serverUrl);
        serverUrlSchema.parse(url);
        const health = await probeFasoBarHealth(url);
        if (!health.ok) {
          return { ok: false as const, error: health.error };
        }
        desktopConfig = { ...desktopConfig, serverUrl: url };
        writeDesktopConfig(desktopConfig);
        await openConfiguredApp(desktopConfig);
        return { ok: true as const };
      } catch (error) {
        return {
          ok: false as const,
          error:
            error instanceof Error ? error.message : "Adresse invalide.",
        };
      }
    },
  );

  ipcMain.handle("desktop:reset-config", async () => {
    resetDesktopConfig();
    desktopConfig = null;
    await localServer?.stop();
    localServer = null;
    destroyTray();
    app.setLoginItemSettings({ openAtLogin: false });
    const win = getMainWindow() ?? createMainWindow({ show: true });
    await loadSetup(win);
    win.show();
    return { ok: true as const };
  });

  ipcMain.handle("desktop:copy-text", (_event, text: string) => {
    clipboard.writeText(String(text ?? ""));
    return { ok: true as const };
  });

  ipcMain.handle("desktop:show-tech-info", async () => {
    const lan =
      desktopConfig?.installationMode === "SERVEUR_CAISSE"
        ? buildLanServerUrl(desktopConfig.serverPort)
        : desktopConfig?.serverUrl;
    await dialog.showMessageBox({
      type: "info",
      title: "FasoBar — informations techniques",
      message: "Informations techniques",
      detail: [
        `Version : ${APP_VERSION}`,
        `Mode : ${desktopConfig?.installationMode ?? "non configuré"}`,
        `Adresse : ${lan ?? "—"}`,
        `UserData : ${app.getPath("userData")}`,
        `Logs serveur : ${localServer?.getLogPath() ?? "—"}`,
      ].join("\n"),
    });
  });
}

app.whenReady().then(async () => {
  registerIpc();
  desktopConfig = readDesktopConfig();

  const win = createMainWindow({ show: true });
  attachNavigationGuard(win, getConfig);

  try {
    await loadSplash(win);
  } catch (error) {
    console.error("[FasoBar][startup] splash failed (continuing)", error);
  }

  win.maximize();
  win.show();

  try {
    if (!desktopConfig) {
      await loadSetup(win);
      return;
    }

    await openConfiguredApp(desktopConfig);
  } catch (error) {
    console.error("[FasoBar][startup] fatal startup error", error);
    try {
      await loadErrorPage(
        win,
        error instanceof Error
          ? error.message
          : "Démarrage de FasoBar impossible.",
      );
    } catch {
      // ignore
    }
  }
}).catch((error) => {
  console.error("[FasoBar][startup] whenReady failed", error);
});

app.on("window-all-closed", () => {
  if (desktopConfig?.installationMode !== "SERVEUR_CAISSE") {
    if (process.platform !== "darwin") {
      app.quit();
    }
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const win = createMainWindow({ show: true });
    void (desktopConfig ? openConfiguredApp(desktopConfig) : loadSetup(win));
  } else {
    showAndFocusMainWindow();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  void localServer?.stop();
});
