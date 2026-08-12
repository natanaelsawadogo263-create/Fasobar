import { z } from "zod";

import {
  DEFAULT_SERVER_PORT,
  INSTALLATION_MODES,
} from "./constants";

const ipv4Regex =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true;
  }
  if (!ipv4Regex.test(host)) {
    return false;
  }
  const parts = host.split(".").map(Number);
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 127) return true;
  return false;
}

export const installationModeSchema = z.enum(INSTALLATION_MODES);

export const serverPortSchema = z
  .number()
  .int()
  .min(1024)
  .max(65535)
  .default(DEFAULT_SERVER_PORT);

/**
 * Accepte uniquement http:// sur localhost ou IPv4 privée (LAN).
 * Rejette https distant, domaines publics, credentials, etc.
 */
export const serverUrlSchema = z
  .string()
  .trim()
  .min(1, "Adresse du serveur obligatoire.")
  .superRefine((value, ctx) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Adresse invalide. Exemple : http://192.168.1.10:3180",
      });
      return;
    }

    if (url.protocol !== "http:") {
      ctx.addIssue({
        code: "custom",
        message: "Seul le protocole http:// est autorisé sur le réseau local.",
      });
      return;
    }

    if (url.username || url.password) {
      ctx.addIssue({
        code: "custom",
        message: "Les identifiants dans l’URL ne sont pas autorisés.",
      });
      return;
    }

    if (!isPrivateOrLocalHostname(url.hostname)) {
      ctx.addIssue({
        code: "custom",
        message:
          "L’adresse doit être locale (127.0.0.1) ou sur le réseau privé (ex. 192.168.x.x).",
      });
    }
  });

export const desktopConfigSchema = z.object({
  installationMode: installationModeSchema,
  serverPort: serverPortSchema,
  serverUrl: z.string().nullable().default(null),
  installationId: z.string().uuid(),
  appVersion: z.string().min(1),
  configuredAt: z.string().datetime().optional(),
});

export type DesktopConfig = z.infer<typeof desktopConfigSchema>;

export const desktopHealthSchema = z
  .object({
    status: z.literal("ok"),
    app: z.literal("FasoBar"),
    version: z.string().min(1),
    mode: z.literal("desktop"),
  })
  .passthrough();

export type DesktopHealth = z.infer<typeof desktopHealthSchema>;

export function parseDesktopConfig(raw: unknown): DesktopConfig {
  return desktopConfigSchema.parse(raw);
}

export function safeParseDesktopConfig(raw: unknown) {
  return desktopConfigSchema.safeParse(raw);
}

export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  const parsed = serverUrlSchema.parse(withProtocol);
  return new URL(parsed).origin;
}

export function isForbiddenSecretContent(content: string): boolean {
  const patterns = [
    /SUPABASE_SECRET_KEY/i,
    /SUPABASE_SERVICE_ROLE_KEY/i,
    /SERVICE_ROLE_KEY/i,
    /OPENAI_API_KEY/i,
  ];
  return patterns.some((p) => p.test(content));
}
