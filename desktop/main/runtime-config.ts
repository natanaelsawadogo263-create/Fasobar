import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { app } from "electron";

import {
  DEFAULT_SERVER_PORT,
  CONFIG_FILE_NAME,
  type InstallationMode,
} from "../shared/constants";
import {
  type DesktopConfig,
  safeParseDesktopConfig,
} from "../shared/config-schema";

function configPath(): string {
  return path.join(app.getPath("userData"), CONFIG_FILE_NAME);
}

export function createDefaultConfig(
  mode: InstallationMode,
  appVersion: string,
): DesktopConfig {
  return {
    installationMode: mode,
    serverPort: DEFAULT_SERVER_PORT,
    serverUrl:
      mode === "SERVEUR_CAISSE" ? `http://127.0.0.1:${DEFAULT_SERVER_PORT}` : null,
    installationId: randomUUID(),
    appVersion,
    configuredAt: new Date().toISOString(),
  };
}

export function readDesktopConfig(): DesktopConfig | null {
  const file = configPath();
  if (!fs.existsSync(file)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    const parsed = safeParseDesktopConfig(raw);
    if (!parsed.success) {
      console.error("[desktop-config] invalid config", parsed.error.issues);
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error("[desktop-config] corrupt config", error);
    return null;
  }
}

export function writeDesktopConfig(config: DesktopConfig): void {
  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

export function resetDesktopConfig(): void {
  const file = configPath();
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

export function getConfigFilePath(): string {
  return configPath();
}
