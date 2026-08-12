/** Numéro WhatsApp (digits internationaux) à partir d’un téléphone BF. */
export function toWhatsAppDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("226") && digits.length >= 11) return digits.slice(0, 11);
  if (digits.length === 8) return `226${digits}`;
  if (digits.length >= 10) return digits;
  return null;
}
