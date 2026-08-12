export const AUTH_ROUTES = new Set([
  "/connexion",
  "/inscription",
  "/inscription/activite",
]);

export const PROTECTED_PREFIXES = [
  "/application",
  "/onboarding",
  "/premiere-connexion",
  "/platform",
  "/abonnement",
  "/acces-saas-bloque",
  "/acces-refuse",
  "/acces-suspendu",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.has(pathname);
}

export function shouldRedirectUnauthenticated(pathname: string, isAuthenticated: boolean): boolean {
  return isProtectedPath(pathname) && !isAuthenticated;
}

export function shouldRedirectAuthenticatedFromAuth(pathname: string, isAuthenticated: boolean): boolean {
  return isAuthenticated && isAuthRoute(pathname);
}

export function resolvePostLoginPath(
  hasActiveOrganization: boolean,
  isPlatformAdmin = false,
): string {
  if (isPlatformAdmin) {
    return "/platform";
  }

  return hasActiveOrganization ? "/application" : "/onboarding";
}

export function getBootstrapBlockedMessage(hasActiveOrganization: boolean): string | null {
  if (hasActiveOrganization) {
    return "Vous avez déjà configuré une organisation.";
  }

  return null;
}
