import { desktopHealthSchema } from "../shared/config-schema";
import { HEALTH_PATH } from "../shared/constants";
import { normalizeServerUrl } from "../shared/config-schema";

export async function probeFasoBarHealth(
  serverUrl: string,
  timeoutMs = 5000,
): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
  let origin: string;
  try {
    origin = normalizeServerUrl(serverUrl);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Adresse du serveur invalide.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${origin}${HEALTH_PATH}`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Le serveur a répondu HTTP ${response.status}.`,
      };
    }

    const json: unknown = await response.json();
    const parsed = desktopHealthSchema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        error: "La réponse n’est pas un serveur FasoBar valide.",
      };
    }

    return { ok: true, version: parsed.data.version };
  } catch {
    return {
      ok: false,
      error:
        "Le serveur FasoBar du PC Caisse est inaccessible. Vérifiez que le PC Caisse et le réseau local sont allumés.",
    };
  } finally {
    clearTimeout(timer);
  }
}
