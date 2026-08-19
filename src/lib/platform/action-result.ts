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
  if (/platform_subscription_payments_tx_ref_key/i.test(message)) {
    return {
      ok: false,
      error:
        "Cette référence de transaction est déjà enregistrée sur un autre paiement.",
    };
  }
  return { ok: false, error: message };
}

export function okResult(): PlatformActionResult {
  return { ok: true };
}
