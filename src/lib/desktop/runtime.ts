import "server-only";

/** Runtime FasoBar — never infer from NODE_ENV alone. */
export const DESKTOP_RUNTIME = "desktop-server" as const;
export type FasoBarRuntime = typeof DESKTOP_RUNTIME | "web";

export function getFasoBarRuntime(): FasoBarRuntime {
  return process.env.FASOBAR_RUNTIME === DESKTOP_RUNTIME
    ? DESKTOP_RUNTIME
    : "web";
}

export function isDesktopServerRuntime(): boolean {
  return getFasoBarRuntime() === DESKTOP_RUNTIME;
}

export function getDesktopUserDataPath(): string | null {
  if (!isDesktopServerRuntime()) {
    return null;
  }
  const value = process.env.FASOBAR_USER_DATA?.trim();
  return value ? value : null;
}

export function getDesktopInstallationIdFromEnv(): string | null {
  const value = process.env.FASOBAR_INSTALLATION_ID?.trim();
  return value ? value : null;
}

export function getDesktopAppVersionFromEnv(): string {
  return (
    process.env.FASOBAR_APP_VERSION?.trim() ||
    process.env.npm_package_version ||
    "0.1.0"
  );
}
