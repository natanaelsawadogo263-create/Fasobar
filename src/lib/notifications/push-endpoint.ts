/**
 * Services push des navigateurs (Chrome/Edge/Firefox/Safari). Le cron envoie
 * une requête HTTP vers `endpoint` : sans cette liste, un utilisateur pourrait
 * faire appeler par le serveur une URL arbitraire (SSRF vers un réseau interne).
 */
const PUSH_SERVICE_HOST_SUFFIXES = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

export function isValidPushKey(value: string): boolean {
  return value.length <= 256 && /^[A-Za-z0-9_\-=+/]+$/.test(value);
}
