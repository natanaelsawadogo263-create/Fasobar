import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Explicit scrypt parameters for local offline verifiers. */
export const LOCAL_PASSWORD_ALGORITHM = "scrypt-N16384-r8-p1-keylen64" as const;

export const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keylen: 64,
  maxmem: 64 * 1024 * 1024,
} as const;

const SALT_BYTES = 16;

export type LocalPasswordVerifier = {
  algorithm: typeof LOCAL_PASSWORD_ALGORITHM;
  saltHex: string;
  verifierHex: string;
};

export function createLocalPasswordVerifier(password: string): LocalPasswordVerifier {
  if (!password) {
    throw new Error("Mot de passe requis pour le vérificateur local.");
  }

  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_PARAMS.maxmem,
  });

  return {
    algorithm: LOCAL_PASSWORD_ALGORITHM,
    saltHex: salt.toString("hex"),
    verifierHex: derived.toString("hex"),
  };
}

export function verifyLocalPassword(
  password: string,
  saltHex: string,
  verifierHex: string,
  algorithm: string = LOCAL_PASSWORD_ALGORITHM,
): boolean {
  if (algorithm !== LOCAL_PASSWORD_ALGORITHM) {
    return false;
  }
  if (!password || !saltHex || !verifierHex) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(verifierHex, "hex");
    if (salt.length !== SALT_BYTES || expected.length !== SCRYPT_PARAMS.keylen) {
      return false;
    }

    const actual = scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
      maxmem: SCRYPT_PARAMS.maxmem,
    });

    if (actual.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
