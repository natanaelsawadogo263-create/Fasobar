export type DesktopConnectivityLabel =
  | "En ligne"
  | "Mode hors connexion"
  | "Synchronisation";

/**
 * Map health/sync payload to the user-facing connectivity label.
 */
export function resolveDesktopConnectivityLabel(
  status: string | undefined,
  reachable: boolean | undefined,
): DesktopConnectivityLabel {
  if (reachable === false || status === "OFFLINE") {
    return "Mode hors connexion";
  }
  if (status === "SYNCING" || status === "ONLINE_PENDING") {
    return "Synchronisation";
  }
  return "En ligne";
}
