/** Message unique affiché à l’admin et aux employés. */
export const USER_ERROR_MESSAGE =
  "L’opération n’a pas abouti. Réessayez dans un instant.";

const TECHNICAL_PATTERNS = [
  /\b(postgres|postgrest|pgrst|supabase|sqlstate)\b/i,
  /\b(column|relation|table|function|schema|index)\b.+\b(does not exist|n'existe pas)\b/i,
  /\b(duplicate key|unique constraint|foreign key|violates|null value in column)\b/i,
  /\b(permission denied|row-level security|\brls\b|schema cache)\b/i,
  /\b(42p01|23505|23503|23502|pgrst\d+)\b/i,
  /\bcontext:/i,
  /^error:\s/i,
  /\b(typeerror|referenceerror|syntaxerror)\b/i,
  /\bfetch failed\b/i,
  /\beconnrefused\b/i,
  /\bundefined is not\b/i,
  /\bcannot read propert/i,
  /\{[\s\S]*"code"[\s\S]*\}/,
  /::(uuid|integer|text|jsonb|numeric|boolean)/i,
  /\.(ts|js|tsx|jsx):\d+/,
  /\bselect\s+.+\s+from\s+/i,
  /\bfailed to (run|fetch|parse|compile|execute)\b/i,
  /\binvalid (input|reference|api key)\b/i,
  /\bjson\b/i,
];

function readMessage(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value instanceof Error) return value.message.trim();
  if (typeof value === "object" && value !== null && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message.trim();
  }
  return "";
}

export function looksTechnicalError(message: string): boolean {
  const text = message.trim();
  if (!text) return true;
  if (text.length > 160) return true;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(text));
}

/** Transforme une erreur technique (SQL, API…) en message simple pour l’utilisateur. */
export function toUserFacingError(value: unknown): string {
  const text = readMessage(value);
  if (!text || looksTechnicalError(text)) {
    return USER_ERROR_MESSAGE;
  }
  return text;
}
