import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { app } from "electron";

export type LocalServerStatus =
  | "stopped"
  | "starting"
  | "running"
  | "error"
  | "restarting";

type LocalServerOptions = {
  port: number;
  installationId: string;
  appVersion: string;
  onStatus?: (status: LocalServerStatus, detail?: string) => void;
};

function resolveNextAppRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "next-app");
  }
  return path.join(app.getAppPath(), "desktop", "resources", "next-app");
}

function resolvePublicEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("NEXT_PUBLIC_") || !value) continue;
    env[key] = value;
  }
  return env;
}

export class LocalNextServer {
  private child: ChildProcess | null = null;
  private status: LocalServerStatus = "stopped";
  private restartAttempts = 0;
  private intentionalStop = false;
  private readonly maxRestarts = 3;
  private readonly logPath: string;
  private readonly port: number;
  private readonly installationId: string;
  private readonly appVersion: string;
  private readonly onStatus?: LocalServerOptions["onStatus"];

  constructor(options: LocalServerOptions) {
    this.port = options.port;
    this.installationId = options.installationId;
    this.appVersion = options.appVersion;
    this.onStatus = options.onStatus;
    this.logPath = path.join(app.getPath("userData"), "logs", "fasobar-server.log");
    fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
  }

  getStatus(): LocalServerStatus {
    return this.status;
  }

  getLogPath(): string {
    return this.logPath;
  }

  private setStatus(status: LocalServerStatus, detail?: string) {
    this.status = status;
    this.onStatus?.(status, detail);
  }

  private appendLog(line: string) {
    try {
      fs.appendFileSync(this.logPath, `${new Date().toISOString()} ${line}\n`);
    } catch {
      // ignore log failures
    }
  }

  async start(): Promise<void> {
    if (this.child) {
      return;
    }

    this.intentionalStop = false;
    this.setStatus("starting");

    const root = resolveNextAppRoot();
    const serverJs = path.join(root, "server.js");
    if (!fs.existsSync(serverJs)) {
      const message = `Serveur Next introuvable : ${serverJs}. Exécutez npm run desktop:prepare.`;
      this.appendLog(message);
      this.setStatus("error", message);
      throw new Error(message);
    }

    const env = {
      ...process.env,
      ...resolvePublicEnv(),
      PORT: String(this.port),
      HOSTNAME: "0.0.0.0",
      ELECTRON_RUN_AS_NODE: "1",
      FASOBAR_RUNTIME: "desktop-server",
      FASOBAR_USER_DATA: app.getPath("userData"),
      FASOBAR_INSTALLATION_ID: this.installationId,
      FASOBAR_APP_VERSION: this.appVersion,
      FASOBAR_INSTALLATION_MODE: "SERVEUR_CAISSE",
    };

    this.child = spawn(process.execPath, [serverJs], {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    this.child.stdout?.on("data", (chunk: Buffer) => {
      this.appendLog(chunk.toString("utf8").trimEnd());
    });
    this.child.stderr?.on("data", (chunk: Buffer) => {
      this.appendLog(`[err] ${chunk.toString("utf8").trimEnd()}`);
    });

    this.child.on("exit", (code, signal) => {
      this.child = null;
      this.appendLog(`exit code=${code} signal=${signal}`);
      if (this.intentionalStop) {
        this.setStatus("stopped");
        return;
      }

      this.restartAttempts += 1;
      const detail = `Arrêt inattendu (${code ?? signal}) — échec ${this.restartAttempts}/${this.maxRestarts}`;
      this.appendLog(detail);
      this.setStatus("error", detail);

      if (this.restartAttempts >= this.maxRestarts) {
        const fatal =
          `Serveur Next arrêté après ${this.maxRestarts} échecs consécutifs. ` +
          `Consultez ${this.logPath}. Plus aucun redémarrage automatique.`;
        this.appendLog(fatal);
        this.setStatus("error", fatal);
        return;
      }

      this.setStatus(
        "restarting",
        `Tentative ${this.restartAttempts + 1}/${this.maxRestarts}`,
      );
      void this.start().catch((error) => {
        this.appendLog(`restart failed: ${String(error)}`);
      });
    });

    // Attendre un court délai pour laisser le bind TCP
    await new Promise((resolve) => setTimeout(resolve, 1200));
    // Ne PAS reset restartAttempts ici : un crash-loop rapide ne doit pas
    // recommencer indéfiniment. Le compteur est remis à 0 seulement après
    // un arrêt volontaire / restart manuel explicite.
    if (this.child && !this.child.killed) {
      this.setStatus("running");
    }
  }

  async stop(): Promise<void> {
    this.intentionalStop = true;
    this.restartAttempts = 0;
    if (!this.child) {
      this.setStatus("stopped");
      return;
    }

    const child = this.child;
    this.child = null;

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      child.once("exit", done);
      child.kill();
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
        done();
      }, 4000);
    });

    this.setStatus("stopped");
  }

  async restart(): Promise<void> {
    await this.stop();
    this.intentionalStop = false;
    this.restartAttempts = 0;
    await this.start();
  }
}
