/** Retour caisse après impression (nouvelle vente). */
export const CAISSE_FRESH_PATH = "/application/caisse?fresh=1";

export function buildReceiptHref(
  receiptId: string,
  options?: {
    print?: boolean;
    returnTo?: string;
  },
): string {
  const params = new URLSearchParams();
  if (options?.print) {
    params.set("print", "1");
  }
  params.set("next", options?.returnTo ?? CAISSE_FRESH_PATH);
  return `/application/recus/${receiptId}?${params.toString()}`;
}
