import "server-only";

import { resolveMx } from "node:dns/promises";

/**
 * Services d'adresses jetables / temporaires les plus courants.
 * Liste volontairement courte et stable : la vraie garantie reste l'e-mail
 * de confirmation, ceci bloque seulement les abus évidents.
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "10minutemail.net",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.net",
  "tempmailo.com",
  "temp-mail.io",
  "tempail.com",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.de",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "maildrop.cc",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "emailondeck.com",
  "fakeinbox.com",
  "fakemail.net",
  "spamgourmet.com",
  "mailcatch.com",
  "moakt.com",
  "jetable.org",
  "mail-temporaire.fr",
  "crazymailing.com",
  "burnermail.io",
  "discard.email",
  "mailpoof.com",
  "emailfake.com",
  "1secmail.com",
  "1secmail.net",
  "1secmail.org",
  "byom.de",
  "dropmail.me",
  "minuteinbox.com",
  "inboxkitten.com",
]);

/** Domaines réservés aux tests / exemples (RFC 2606) — jamais de vraie boîte. */
const RESERVED_EMAIL_DOMAINS = ["example.com", "example.net", "example.org", "test", "invalid", "localhost", "example"];

const DNS_TIMEOUT_MS = 4000;

export type EmailDeliverabilityResult = { ok: true } | { ok: false; error: string };

function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@").pop() ?? "";
}

export function isDisposableEmailDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  return [...DISPOSABLE_EMAIL_DOMAINS].some(
    (blocked) => lower === blocked || lower.endsWith(`.${blocked}`),
  );
}

export function isReservedEmailDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  return RESERVED_EMAIL_DOMAINS.some(
    (reserved) => lower === reserved || lower.endsWith(`.${reserved}`),
  );
}

async function domainAcceptsMail(domain: string): Promise<boolean | null> {
  const lookup = resolveMx(domain).then(
    (records) => records.some((record) => record.exchange && record.exchange !== "."),
    (error: NodeJS.ErrnoException) => {
      // Domaine inexistant ou sans serveur mail : adresse impossible.
      if (error.code === "ENOTFOUND" || error.code === "ENODATA") {
        return false;
      }
      // Panne DNS passagère : ne pas bloquer une vraie inscription
      // (l'e-mail de confirmation reste obligatoire).
      return null;
    },
  );
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), DNS_TIMEOUT_MS);
  });
  return Promise.race([lookup, timeout]);
}

/**
 * Vérifie qu'une adresse peut réellement recevoir des e-mails :
 * domaine non réservé, non jetable, et doté d'un serveur mail (MX).
 */
export async function checkEmailDeliverability(
  email: string,
): Promise<EmailDeliverabilityResult> {
  const domain = emailDomain(email);
  if (!domain || !domain.includes(".")) {
    return { ok: false, error: "Adresse e-mail invalide." };
  }

  if (isReservedEmailDomain(domain)) {
    return {
      ok: false,
      error: "Utilisez une adresse e-mail réelle (pas une adresse d'exemple ou de test).",
    };
  }

  if (isDisposableEmailDomain(domain)) {
    return {
      ok: false,
      error: "Les adresses e-mail temporaires ou jetables ne sont pas acceptées.",
    };
  }

  const acceptsMail = await domainAcceptsMail(domain);
  if (acceptsMail === false) {
    return {
      ok: false,
      error: "Ce domaine e-mail n'existe pas ou ne peut pas recevoir d'e-mails. Vérifiez l'adresse.",
    };
  }

  return { ok: true };
}
