/** Domain used for new employee Auth emails (must be a real TLD — Supabase rejects .internal). */
export const FASOBAR_INTERNAL_AUTH_DOMAIN = "users.fasobar.app";

/** Legacy domain kept so existing employees can still sign in. */
const FASOBAR_INTERNAL_AUTH_DOMAINS = [
  FASOBAR_INTERNAL_AUTH_DOMAIN,
  "users.fasobar.internal",
] as const;

const LOGIN_PATTERN = /^[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]$|^[a-z0-9]{3,64}$/;

/**
 * Normalize a FasoBar login identifier (case-insensitive, no spaces).
 */
export function normalizeLoginIdentifier(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

export function isValidLoginIdentifier(raw: string): boolean {
  const normalized = normalizeLoginIdentifier(raw);
  if (normalized.length < 3 || normalized.length > 64) {
    return false;
  }
  return LOGIN_PATTERN.test(normalized);
}

/**
 * Suggest a login from a display name: "Awa Ouédraogo" → "awa.ouedraogo".
 */
export function suggestLoginIdentifierFromName(fullName: string): string {
  const parts = fullName
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[\s'_-]+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) {
    return "employe";
  }

  const base =
    parts.length === 1 ? parts[0]! : `${parts[0]}.${parts[parts.length - 1]}`;
  return normalizeLoginIdentifier(base).slice(0, 64) || "employe";
}

/** Append a short suffix when the base identifier is taken. */
export function withLoginIdentifierSuffix(base: string, suffix: string): string {
  const normalizedBase = normalizeLoginIdentifier(base).slice(0, 56);
  const cleanSuffix = suffix.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 6);
  return normalizeLoginIdentifier(`${normalizedBase}-${cleanSuffix}`);
}

/**
 * Map identifier → deterministic internal Auth email.
 * Real personal emails are never derived or exposed by this helper.
 */
export function loginIdentifierToAuthEmail(loginIdentifier: string): string {
  return loginIdentifierToAuthEmails(loginIdentifier)[0]!;
}

export function loginIdentifierToAuthEmails(loginIdentifier: string): string[] {
  const normalized = normalizeLoginIdentifier(loginIdentifier);
  if (!normalized) {
    throw new Error("Identifiant FasoBar invalide.");
  }
  return FASOBAR_INTERNAL_AUTH_DOMAINS.map((domain) => `${normalized}@${domain}`);
}

/**
 * Resolve what to pass to Supabase signInWithPassword.
 * - Looks like email → use as-is (legacy accounts)
 * - Otherwise → internal auth emails from login_identifier (current + legacy domain)
 */
export function resolveSupabaseAuthEmail(identifierOrEmail: string): string {
  return resolveSupabaseAuthEmails(identifierOrEmail)[0]!;
}

export function resolveSupabaseAuthEmails(identifierOrEmail: string): string[] {
  const trimmed = identifierOrEmail.trim();
  if (trimmed.includes("@")) {
    return [trimmed.toLowerCase()];
  }
  return loginIdentifierToAuthEmails(trimmed);
}

export function isInternalFasoBarAuthEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return FASOBAR_INTERNAL_AUTH_DOMAINS.some((domain) => lower.endsWith(`@${domain}`));
}

export function loginKeyFromIdentifier(identifierOrEmail: string): {
  isEmail: boolean;
  loginKey: string;
} {
  const trimmed = identifierOrEmail.trim();
  if (!trimmed) {
    return { isEmail: false, loginKey: "" };
  }
  if (isInternalFasoBarAuthEmail(trimmed)) {
    return {
      isEmail: false,
      loginKey: normalizeLoginIdentifier(trimmed.split("@")[0] ?? ""),
    };
  }
  if (trimmed.includes("@")) {
    return { isEmail: true, loginKey: trimmed.toLowerCase() };
  }
  return { isEmail: false, loginKey: normalizeLoginIdentifier(trimmed) };
}
