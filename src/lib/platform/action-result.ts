export type PlatformActionResult =
  | { ok: true }
  | { ok: false; error: string };

export function isMissingRpcError(message: string): boolean {
  return /Could not find the function|PGRST202|schema cache|does not exist/i.test(
    message,
  );
}

export function mapRpcFailure(message: string): PlatformActionResult {
  if (isMissingRpcError(message)) {
    return {
      ok: false,
      error:
        "Fonction plateforme indisponible. Vérifiez que les migrations ont été appliquées.",
    };
  }
  return { ok: false, error: message };
}

export function okResult(): PlatformActionResult {
  return { ok: true };
}
