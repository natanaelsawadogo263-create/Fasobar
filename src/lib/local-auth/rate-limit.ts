import "server-only";

import {
  LOGIN_RATE_LIMIT_MAX_FAILURES,
  LOGIN_RATE_LIMIT_WINDOW_MS,
} from "@/lib/local-auth/constants";
import type { SqlDatabase } from "@/lib/local-db/types";

export type LoginAttemptSource = "online" | "offline" | "unknown" | string;

export function recordLoginAttempt(
  db: SqlDatabase,
  normalizedLogin: string,
  success: boolean,
  source: LoginAttemptSource = "unknown",
): void {
  db.prepare(
    `INSERT INTO local_login_attempts (
      login_identifier_normalized, attempted_at, success, source
    ) VALUES (?, ?, ?, ?)`,
  ).run(
    normalizedLogin,
    new Date().toISOString(),
    success ? 1 : 0,
    source,
  );
}

export function countRecentFailures(
  db: SqlDatabase,
  normalizedLogin: string,
  windowMs: number = LOGIN_RATE_LIMIT_WINDOW_MS,
): number {
  const since = new Date(Date.now() - windowMs).toISOString();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM local_login_attempts
       WHERE login_identifier_normalized = ?
         AND success = 0
         AND attempted_at >= ?`,
    )
    .get(normalizedLogin, since);
  return Number(row?.cnt ?? 0);
}

export function isLoginRateLimited(
  db: SqlDatabase,
  normalizedLogin: string,
): boolean {
  return (
    countRecentFailures(db, normalizedLogin) >= LOGIN_RATE_LIMIT_MAX_FAILURES
  );
}
