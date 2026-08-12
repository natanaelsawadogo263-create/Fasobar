/** Cookie name for desktop local sessions (HttpOnly). */
export const LOCAL_SESSION_COOKIE = "fasobar_lsid";

/** Local session lifetime (12 hours). */
export const LOCAL_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Sliding window for failed login attempts. */
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** Max failed attempts per identifier within the window. */
export const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;

/** Generic message — never distinguish missing user vs bad password. */
export const GENERIC_AUTH_ERROR = "Identifiant ou mot de passe incorrect.";
