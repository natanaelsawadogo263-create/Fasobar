/**
 * Canonical public origin for Auth e-mail redirects (password reset, confirm).
 * Prefer an explicit env URL so the value matches Supabase Redirect URLs
 * even when the request Host differs (LAN, alternate port, proxies).
 */
export function getAuthRedirectOrigin(headerStore: Headers): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return "http://localhost:3000";
  }

  return `${protocol}://${host}`;
}

/** Safe in-app path for post-auth redirects (no open redirect). */
export function sanitizeAuthNextPath(
  nextPath: string | null | undefined,
  fallback = "/application",
): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return fallback;
  }
  return nextPath;
}
