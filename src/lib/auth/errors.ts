import type { AuthError } from "@supabase/supabase-js";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_not_confirmed:
    "Veuillez confirmer votre adresse e-mail avant de vous connecter.",
  user_already_exists: "Un compte existe déjà avec cette adresse e-mail.",
  weak_password: "Le mot de passe ne respecte pas les critères de sécurité.",
  over_request_rate_limit:
    "Trop de tentatives. Veuillez réessayer dans quelques minutes.",
  over_email_send_rate_limit:
    "Trop d'e-mails envoyés par Supabase (quota gratuit très bas). Attendez environ une heure, ou configurez un SMTP personnalisé dans le projet Supabase.",
  email_address_invalid:
    "Adresse e-mail refusée. Utilisez une adresse réelle (évitez example.com et les domaines de test).",
  same_password:
    "Le nouveau mot de passe doit être différent de l'ancien.",
  signup_disabled: "Les inscriptions sont temporairement désactivées.",
};

export function mapAuthError(error: AuthError | null): string {
  if (!error) {
    return "Une erreur inattendue est survenue.";
  }

  if (error.code && AUTH_ERROR_MESSAGES[error.code]) {
    return AUTH_ERROR_MESSAGES[error.code];
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return AUTH_ERROR_MESSAGES.invalid_credentials;
  }

  if (message.includes("email not confirmed")) {
    return AUTH_ERROR_MESSAGES.email_not_confirmed;
  }

  if (message.includes("user already registered")) {
    return AUTH_ERROR_MESSAGES.user_already_exists;
  }

  if (message.includes("email rate limit") || message.includes("over_email")) {
    return AUTH_ERROR_MESSAGES.over_email_send_rate_limit;
  }

  if (message.includes("email address") && message.includes("invalid")) {
    return AUTH_ERROR_MESSAGES.email_address_invalid;
  }

  if (
    message.includes("redirect") ||
    message.includes("redirect_uri") ||
    (error.code === "validation_failed" && message.includes("url"))
  ) {
    return "Lien de réinitialisation refusé par Supabase. Ajoutez l'URL de l'app (ex. http://localhost:3000/auth/callback) dans Authentication → URL Configuration → Redirect URLs.";
  }

  if (message.includes("database error saving new user")) {
    return "Création du profil impossible. Vérifiez les triggers profiles / RLS côté base.";
  }

  if (message.includes("password")) {
    return AUTH_ERROR_MESSAGES.weak_password;
  }

  console.error("[auth]", error.code ?? "unknown", error.message);

  return "Impossible de traiter votre demande. Veuillez réessayer.";
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "";
}

export function mapGenericError(error: unknown): string {
  const message = readErrorMessage(error);

  if (message.includes("organisation active")) {
    return "Vous avez déjà configuré une organisation.";
  }

  if (message.includes("Slug invalide")) {
    return "Le slug indiqué n'est pas valide.";
  }

  if (
    message.includes("organizations_slug_key") ||
    (message.includes("slug") && message.includes("already exists"))
  ) {
    return "Ce nom commercial est déjà utilisé. Choisissez un nom plus précis (ex. Maquis Le Palmier Ouaga).";
  }

  if (message.includes("duplicate key") || message.includes("unique")) {
    return "Un enregistrement similaire existe déjà. Vérifiez le nom de l'établissement.";
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    const details =
      "details" in error && typeof error.details === "string"
        ? error.details
        : "";
    if (details.includes("organizations_slug_key") || message.includes("slug")) {
      return "Ce nom commercial est déjà utilisé. Choisissez un nom plus précis.";
    }
    return "Un enregistrement similaire existe déjà. Vérifiez le nom de l'établissement.";
  }

  const cleaned = message
    .replace(/^.*ERROR:\s*/i, "")
    .replace(/\s+CONTEXT:[\s\S]*$/i, "")
    .trim();

  if (cleaned && cleaned.length > 0 && cleaned.length < 220 && !cleaned.includes("json")) {
    return cleaned;
  }

  return "Une erreur inattendue est survenue. Veuillez réessayer.";
}
