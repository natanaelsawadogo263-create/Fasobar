import {
  Menu,
  Tray,
  app,
  clipboard,
  nativeImage,
  type BrowserWindow,
} from "electron";
import path from "node:path";

import type { LocalServerStatus } from "./local-server";
import { showAndFocusMainWindow } from "./windows";

let tray: Tray | null = null;

function trayIcon(): Electron.NativeImage {
  const iconFile = app.isPackaged
    ? path.join(process.resourcesPath, "assets", "tray-icon.png")
    : path.join(app.getAppPath(), "desktop", "assets", "tray-icon.png");
  const image = nativeImage.createFromPath(iconFile);
  if (!image.isEmpty()) {
    return image.resize({ width: 16, height: 16 });
  }
  return nativeImage.createEmpty();
}

export type TrayCallbacks = {
  getServerStatus: () => LocalServerStatus;
  getLanAddress: () => string | null;
  getLocalAddress: () => string;
  onRestartServer: () => Promise<void>;
  onQuit: () => Promise<void>;
};

export function createAppTray(
  _win: BrowserWindow,
  callbacks: TrayCallbacks,
): Tray {
  if (tray) {
    return tray;
  }

  tray = new Tray(trayIcon());
  tray.setToolTip("FasoBar");

  const rebuild = () => {
    if (!tray) return;
    const lan = callbacks.getLanAddress();
    const local = callbacks.getLocalAddress();
    const status = callbacks.getServerStatus();

    const menu = Menu.buildFromTemplate([
      {
        label: "Ouvrir FasoBar",
        click: () => showAndFocusMainWindow(),
      },
      {
        label: `État du serveur : ${status}`,
        enabled: false,
      },
      {
        label: lan
          ? `Adresse réseau : ${lan}`
          : `Adresse locale : ${local}`,
        enabled: false,
      },
      {
        label: "Copier l’adresse du serveur",
        click: () => {
          clipboard.writeText(lan ?? local);
        },
      },
      {
        label: "Redémarrer le serveur",
        click: () => {
          void callbacks.onRestartServer();
        },
      },
      { type: "separator" },
      {
        label: "Quitter complètement FasoBar",
        click: () => {
          void callbacks.onQuit();
        },
      },
    ]);

    tray.setContextMenu(menu);
  };

  rebuild();
  tray.on("double-click", () => showAndFocusMainWindow());

  // Refresh labels periodically
  setInterval(rebuild, 5000);

  app.on("before-quit", () => {
    tray?.destroy();
    tray = null;
  });

  return tray;
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
