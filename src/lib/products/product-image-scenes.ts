/**
 * Scènes catalogue FasoBar — utilisées pour construire le prompt d'édition IA.
 * Aucun rendu Canvas / dégradé ici.
 */

export type ProductImageScene =
  | "beer"
  | "juice"
  | "water"
  | "soda"
  | "food"
  | "spirits"
  | "default";

export type ProductImageSceneInput = {
  categoryName?: string | null;
  productName?: string | null;
  departmentCode?: string | null;
};

export const PRODUCT_IMAGE_SCENE_LABELS: Record<ProductImageScene, string> = {
  beer: "Ambiance bar",
  juice: "Frais / fruité",
  water: "Fraîcheur",
  soda: "Dynamique",
  food: "Table / food",
  spirits: "Premium",
  default: "Studio",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Déduit la scène de fond à partir de la catégorie / du nom. */
export function inferProductImageScene(
  input: ProductImageSceneInput,
): ProductImageScene {
  const category = normalize(input.categoryName ?? "");
  const name = normalize(input.productName ?? "");
  const haystack = `${category} ${name}`;
  const department = (input.departmentCode ?? "").toUpperCase();

  if (
    category.includes("biere") ||
    haystack.includes("brakina") ||
    haystack.includes("castel") ||
    haystack.includes("flag") ||
    haystack.includes("guinness") ||
    haystack.includes("heineken") ||
    haystack.includes("beer")
  ) {
    return "beer";
  }

  if (
    category.includes("eau") ||
    haystack.includes("evian") ||
    haystack.includes("minerale") ||
    haystack.includes("water")
  ) {
    return "water";
  }

  if (
    category.includes("soda") ||
    haystack.includes("coca") ||
    haystack.includes("fanta") ||
    haystack.includes("sprite") ||
    haystack.includes("cola")
  ) {
    return "soda";
  }

  if (
    category.includes("jus") ||
    haystack.includes("orange") ||
    haystack.includes("bissap") ||
    haystack.includes("fruit") ||
    haystack.includes("tropical")
  ) {
    return "juice";
  }

  if (
    category.includes("spiritueux") ||
    haystack.includes("rhum") ||
    haystack.includes("vodka") ||
    haystack.includes("whisky") ||
    haystack.includes("gin")
  ) {
    return "spirits";
  }

  if (
    department === "KITCHEN" ||
    category.includes("plat") ||
    category.includes("dessert") ||
    category.includes("accompagn") ||
    category.includes("nourriture")
  ) {
    return "food";
  }

  return "default";
}

const SCENE_BACKDROPS: Record<ProductImageScene, string[]> = {
  beer: [
    "photorealistic dark bar counter, warm wood grain, soft amber bokeh lights, subtle beer foam atmosphere, moody premium nightlife",
    "moody brass tap room backdrop, shallow depth of field, condensation highlights, cinematic bar lighting",
    "evening maquis/bar ambiance Burkina Faso, warm lantern glow, dark polished counter, soft beer glow",
  ],
  juice: [
    "fresh tropical fruit ambiance, soft orange citrus tones, morning light, condensation, clean healthy beverage vibe",
    "bright fruit-market freshness, mango and citrus hints softly blurred, airy daylight, vibrant but natural colors",
    "chilled juice bar counter with frosted glass mood, sunny tropical atmosphere, crisp and refreshing",
  ],
  water: [
    "clean cool blue freshness, soft water droplets mood, bright daylight, spa-like clarity, pure and light",
    "crystal-clear hydration scene, pale cyan gradient from natural light, ice-cool atmosphere without clutter",
    "minimal fresh mineral-water set, soft sky-blue depth, clean reflections, high-key commercial lighting",
  ],
  soda: [
    "dynamic vibrant soft-drink energy, bold but realistic color wash, lively splash mood, commercial beverage ad lighting",
    "punchy colorful soda campaign backdrop, crisp highlights, energetic bokeh, retail-ready pop without cartoon look",
    "refreshing fizzy soft-drink stage with vivid brand-matching ambient color, studio flash + soft rim light",
  ],
  food: [
    "clean restaurant table setting, soft natural window light, subtle plate and linen context, appetizing food photography",
    "premium plated-food backdrop, warm wood table, shallow depth of field, culinary magazine style",
    "kitchen-pass ready dish presentation, soft bokeh herbs, clean ceramic surface, inviting warm tones",
  ],
  spirits: [
    "luxury spirits presentation, dark velvet and glass reflections, refined gold accents, premium bottle spotlight",
    "high-end cocktail bar shelf mood, soft specular highlights on glass, elegant night ambiance",
    "premium whiskey/rum tasting table, low-key dramatic lighting, rich wood and crystal reflections",
  ],
  default: [
    "clean premium e-commerce studio, soft neutral seamless backdrop, professional catalog lighting",
    "modern retail product studio, soft shadow and gentle rim light, commercial packshot quality",
    "minimal lifestyle product stage, subtle textured backdrop, balanced softbox lighting",
  ],
};

export function buildProductImageEditPrompt(input: {
  scene: ProductImageScene;
  productName?: string | null;
  categoryName?: string | null;
  backgroundVariant?: number;
  regenerate?: boolean;
}): string {
  const variants = SCENE_BACKDROPS[input.scene];
  const variantIndex = Math.abs(input.backgroundVariant ?? 0) % variants.length;
  const backdrop = variants[variantIndex];
  const productLabel = (input.productName ?? "").trim() || "ce produit";
  const categoryLabel = (input.categoryName ?? "").trim() || PRODUCT_IMAGE_SCENE_LABELS[input.scene];
  const regenerateHint = input.regenerate
    ? "Create a clearly different but equally premium realistic backdrop variation while keeping the exact same product identity."
    : "Keep a coherent single commercial composition.";

  return [
    `Transform this photo into a premium commercial product catalog image for FasoBar (West African bar / restaurant POS).`,
    `Product name: ${productLabel}. Category: ${categoryLabel}. Scene style: ${PRODUCT_IMAGE_SCENE_LABELS[input.scene]}.`,
    ``,
    `CRITICAL IDENTITY RULES (must follow strictly):`,
    `- Preserve the exact same physical product from the input photo: shape, packaging, bottle/can/plate, proportions.`,
    `- Preserve the exact label artwork, brand logo, typography, colors and printed text. Do not invent another brand.`,
    `- Do not replace the product with a generic or similar item. The real product identity must remain recognizable.`,
    `- Center the product clearly in the frame for a square catalog card.`,
    ``,
    `QUALITY RULES:`,
    `- Improve sharpness, lighting, color balance, contrast and professional presentation.`,
    `- Photorealistic commercial photography only — no illustration, no cartoon, no flat CSS-like gradients, no fake plastic look.`,
    `- Generate a realistic coherent environment/backdrop: ${backdrop}.`,
    `- Soft natural contact shadow under the product; clean edges; retail e-commerce premium look.`,
    `- ${regenerateHint}`,
    ``,
    `Output a square, high-end packshot ready for a digital product catalog.`,
  ].join("\n");
}
