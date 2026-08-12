import "server-only";

import fs from "node:fs";
import path from "node:path";

import { resolveLocalDataPaths } from "@/lib/local-db/paths";

export type DesktopLogLevel = "info" | "warn" | "error";

function sanitizeMessage(message: string): string {
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt-redacted]")
    .replace(/SUPABASE_[A-Z0-9_]+=\S+/gi, "[env-redacted]")
    .replace(/OPENAI_API_KEY=\S+/gi, "[env-redacted]");
}

/**
 * Structured desktop logs under userData/logs. Never log secrets.
 */
export function appendDesktopLog(
  channel: string,
  level: DesktopLogLevel,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    const { logsDir } = resolveLocalDataPaths();
    fs.mkdirSync(logsDir, { recursive: true });
    const file = path.join(logsDir, "fasobar-desktop.log");
    const entry = {
      ts: new Date().toISOString(),
      channel,
      level,
      message: sanitizeMessage(message),
      ...(details ? { details } : {}),
    };
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Logging must never break the app.
  }
}
