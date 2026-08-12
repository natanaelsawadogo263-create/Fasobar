import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import {
  LOCAL_SESSION_COOKIE,
  LOCAL_SESSION_TTL_MS,
} from "@/lib/local-auth/constants";
import {
  findLocalUserById,
  type LocalUserRow,
} from "@/lib/local-auth/users-repository";
import type { SqlDatabase } from "@/lib/local-db/types";

export type LocalSessionMeta = {
  userAgent?: string | null;
  ipHint?: string | null;
};

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createLocalSession(
  db: SqlDatabase,
  userId: string,
  meta?: LocalSessionMeta,
): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCAL_SESSION_TTL_MS);
  const nowIso = now.toISOString();

  db.prepare(
    `INSERT INTO local_sessions (
      id, user_id, token_hash, created_at, expires_at, last_seen_at,
      revoked_at, user_agent, ip_hint
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  ).run(
    randomUUID(),
    userId,
    tokenHash,
    nowIso,
    expiresAt.toISOString(),
    nowIso,
    meta?.userAgent ?? null,
    meta?.ipHint ?? null,
  );

  return { token, expiresAt };
}

export function validateLocalSession(
  db: SqlDatabase,
  token: string,
): LocalUserRow | null {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = db
    .prepare(
      `SELECT id, user_id, expires_at, revoked_at
       FROM local_sessions
       WHERE token_hash = ?
       LIMIT 1`,
    )
    .get(tokenHash);

  if (!session) {
    return null;
  }

  if (session.revoked_at) {
    return null;
  }

  const expiresAt = Date.parse(String(session.expires_at));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  const nowIso = new Date().toISOString();
  db.prepare(
    `UPDATE local_sessions SET last_seen_at = ? WHERE id = ?`,
  ).run(nowIso, String(session.id));

  return findLocalUserById(db, String(session.user_id));
}

export function revokeLocalSession(db: SqlDatabase, token: string): void {
  if (!token) {
    return;
  }
  const tokenHash = hashSessionToken(token);
  const nowIso = new Date().toISOString();
  db.prepare(
    `UPDATE local_sessions
     SET revoked_at = COALESCE(revoked_at, ?)
     WHERE token_hash = ? AND revoked_at IS NULL`,
  ).run(nowIso, tokenHash);
}

export function revokeAllSessionsForUser(
  db: SqlDatabase,
  userId: string,
): void {
  const nowIso = new Date().toISOString();
  db.prepare(
    `UPDATE local_sessions
     SET revoked_at = COALESCE(revoked_at, ?)
     WHERE user_id = ? AND revoked_at IS NULL`,
  ).run(nowIso, userId);
}

export async function setLocalSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCAL_SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false,
    expires: expiresAt,
  });
}

export async function clearLocalSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCAL_SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false,
    maxAge: 0,
  });
}

export async function readLocalSessionTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCAL_SESSION_COOKIE)?.value?.trim();
  return value || null;
}
