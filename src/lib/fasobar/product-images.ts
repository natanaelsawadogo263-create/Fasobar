import { CAISSE_PRODUCTS } from "@/lib/caisse/catalog";

const PRODUCT_IMAGE_BY_SLUG = Object.fromEntries(
  CAISSE_PRODUCTS.map((product) => [product.slug, `/products/${product.imageFile}`]),
) as Record<string, string>;

const PRODUCT_IMAGE_BY_NAME = Object.fromEntries(
  CAISSE_PRODUCTS.map((product) => [product.name.toLowerCase(), `/products/${product.imageFile}`]),
) as Record<string, string>;

const KEYWORD_FALLBACK: Array<[string, string]> = CAISSE_PRODUCTS.map((product) => [
  product.slug.replace(/-/g, " "),
  `/products/${product.imageFile}`,
]);

const DEFAULT_IMAGE = "/products/brakina.jpg";

function normalizeName(productName: string): string {
  return productName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Image locale connue du catalogue caisse, ou null. */
export function getLocalProductImage(productName: string): string | null {
  const normalized = normalizeName(productName);

  if (PRODUCT_IMAGE_BY_NAME[normalized]) {
    return PRODUCT_IMAGE_BY_NAME[normalized];
  }

  for (const [keyword, url] of KEYWORD_FALLBACK) {
    if (normalized.includes(keyword)) {
      return url;
    }
  }

  for (const product of CAISSE_PRODUCTS) {
    if (normalized.includes(product.slug.replace(/-/g, " "))) {
      return PRODUCT_IMAGE_BY_SLUG[product.slug];
    }
  }

  return null;
}

export function getProductImage(
  productName: string,
  storedUrl?: string | null,
  alternatives?: {
    optimizedUrl?: string | null;
    originalUrl?: string | null;
  },
): string {
  if (alternatives?.optimizedUrl) {
    return alternatives.optimizedUrl;
  }
  if (alternatives?.originalUrl) {
    return alternatives.originalUrl;
  }
  if (storedUrl) {
    return storedUrl;
  }

  return getLocalProductImage(productName) ?? DEFAULT_IMAGE;
}

/** Préfère toujours l'image catalogue optimisée si disponible. */
export function resolveCatalogImageUrl(input: {
  name: string;
  imageUrl?: string | null;
  imageOptimizedUrl?: string | null;
  imageOriginalUrl?: string | null;
}): string {
  return getProductImage(input.name, input.imageUrl, {
    optimizedUrl: input.imageOptimizedUrl,
    originalUrl: input.imageOriginalUrl,
  });
}
