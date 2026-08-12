import { contextBridge, ipcRenderer } from "electron";

const api = {
  getState: () => ipcRenderer.invoke("desktop:get-state"),
  completeSetup: (payload: {
    mode: "SERVEUR_CAISSE" | "POSTE_TRAVAIL";
    serverUrl?: string;
  }) => ipcRenderer.invoke("desktop:complete-setup", payload),
  retryConnection: () => ipcRenderer.invoke("desktop:retry-connection"),
  updateServerUrl: (serverUrl: string) =>
    ipcRenderer.invoke("desktop:update-server-url", serverUrl),
  resetConfig: () => ipcRenderer.invoke("desktop:reset-config"),
  copyText: (text: string) => ipcRenderer.invoke("desktop:copy-text", text),
  showTechInfo: () => ipcRenderer.invoke("desktop:show-tech-info"),
};

contextBridge.exposeInMainWorld("fasobarDesktop", api);

export type FasobarDesktopApi = typeof api;
