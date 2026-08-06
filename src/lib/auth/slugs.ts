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
