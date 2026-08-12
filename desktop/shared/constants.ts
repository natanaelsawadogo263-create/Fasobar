export const DEFAULT_SERVER_PORT = 3180;
export const CONFIG_FILE_NAME = "fasobar-desktop-config.json";
export const APP_DISPLAY_NAME = "FasoBar";
export const HEALTH_PATH = "/api/desktop/health";

export const INSTALLATION_MODES = ["SERVEUR_CAISSE", "POSTE_TRAVAIL"] as const;
export type InstallationMode = (typeof INSTALLATION_MODES)[number];

export const FORBIDDEN_SECRET_PATTERNS = [
  /SUPABASE_SECRET_KEY/i,
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /SERVICE_ROLE/i,
  /OPENAI_API_KEY/i,
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
] as const;
