const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(input: string): string {
  const slug = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw new Error("Slug invalide.");
  }

  return slug;
}

export function slugifyFromName(name: string): string {
  if (!name.trim()) {
    return "";
  }

  try {
    return normalizeSlug(name);
  } catch {
    return "";
  }
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Ajoute un suffixe unique pour éviter les collisions globales (organizations.slug). */
export function withUniqueSlugSuffix(baseSlug: string, salt: string): string {
  const base = slugifyFromName(baseSlug) || "etablissement";
  const cleanSalt = salt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 10);
  const timePart = Date.now().toString(36).slice(-4);
  const suffix = cleanSalt ? `${cleanSalt}${timePart}` : timePart;
  return `${base}-${suffix}`;
}
