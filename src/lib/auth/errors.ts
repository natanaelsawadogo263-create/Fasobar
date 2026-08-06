import type { AuthError } from "@supabase/supabase-js";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_not_confirmed:
    "Veuillez confirmer votre adresse e-mail avant de vous connecter.",
  user_already_exists: "Un compte existe déjà avec cette adresse e-mail.",
  weak_password: "Le mot de passe ne respecte pas les critères de sécurité.",
  over_request_rate_limit:
    "Trop de tentatives. Veuillez réessayer dans quelques minutes.",
  same_password:
    "Le nouveau mot de passe doit être différent de l'ancien.",
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

  if (message.includes("password")) {
    return AUTH_ERROR_MESSAGES.weak_password;
  }

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

  if (message.includes("duplicate key") || message.includes("unique")) {
    return "Un enregistrement similaire existe déjà.";
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    return "Un enregistrement similaire existe déjà.";
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
