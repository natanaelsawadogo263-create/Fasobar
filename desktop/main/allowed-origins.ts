import type { DesktopConfig } from "../shared/config-schema";

function supabaseOriginsFromEnv(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return [];
  try {
    const url = new URL(raw);
    return [`${url.protocol}//${url.host}`];
  } catch {
    return [];
  }
}

export function buildAllowedOrigins(config: DesktopConfig | null): Set<string> {
  const allowed = new Set<string>();
  allowed.add("http://127.0.0.1:3180");
  allowed.add("http://localhost:3180");

  if (config?.serverPort) {
    allowed.add(`http://127.0.0.1:${config.serverPort}`);
    allowed.add(`http://localhost:${config.serverPort}`);
  }

  if (config?.serverUrl) {
    try {
      allowed.add(new URL(config.serverUrl).origin);
    } catch {
      // ignore
    }
  }

  for (const origin of supabaseOriginsFromEnv()) {
    allowed.add(origin);
  }

  return allowed;
}

export function isNavigationAllowed(
  targetUrl: string,
  config: DesktopConfig | null,
): boolean {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return false;
  }

  if (url.protocol === "file:") {
    return true;
  }

  const allowed = buildAllowedOrigins(config);
  if (allowed.has(url.origin)) {
    return true;
  }

  // Autoriser les chemins relatifs sur le serveur configuré
  if (config?.installationMode === "SERVEUR_CAISSE") {
    const port = config.serverPort;
    if (
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      Number(url.port || 80) === port
    ) {
      return true;
    }
  }

  return false;
}
