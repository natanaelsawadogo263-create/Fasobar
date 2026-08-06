import "server-only";

import {
  buildProductImageEditPrompt,
  inferProductImageScene,
  PRODUCT_IMAGE_SCENE_LABELS,
  type ProductImageScene,
  type ProductImageSceneInput,
} from "@/lib/products/product-image-scenes";

const OPENAI_IMAGES_EDIT_URL = "https://api.openai.com/v1/images/edits";
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

/** Modèle économique par défaut — gpt-image-1.5/high consomme beaucoup de quota. */
const DEFAULT_MODEL = "gpt-image-1-mini";
const FALLBACK_MODEL = "gpt-image-1-mini";

export type AiEnhanceProductImageInput = ProductImageSceneInput & {
  image: Blob;
  backgroundVariant?: number;
  regenerate?: boolean;
};

export type AiEnhanceProductImageResult = {
  bytes: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  scene: ProductImageScene;
  sceneLabel: string;
  model: string;
};

type OpenAiErrorInfo = {
  status: number;
  message: string;
  code?: string;
  type?: string;
  isBilling: boolean;
  isRateLimit: boolean;
  isAuth: boolean;
};

function resolveApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Clé OpenAI manquante. Ajoutez OPENAI_API_KEY dans votre fichier .env.local pour activer l'amélioration IA.",
    );
  }
  return key;
}

function resolveModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
}

function resolveQuality(preferred?: string): string {
  const quality = (preferred ?? process.env.OPENAI_IMAGE_QUALITY)?.trim();
  if (quality === "low" || quality === "medium" || quality === "high" || quality === "auto") {
    return quality;
  }
  return "medium";
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  return "png";
}

function parseOpenAiError(status: number, body: string): OpenAiErrorInfo {
  let message = `Échec de l'API d'édition d'image (HTTP ${status}).`;
  let code: string | undefined;
  let type: string | undefined;

  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; code?: string; type?: string };
    };
    if (parsed.error?.message?.trim()) {
      message = parsed.error.message.trim();
    }
    code = parsed.error?.code;
    type = parsed.error?.type;
  } catch {
    // ignore
  }

  const haystack = `${message} ${code ?? ""} ${type ?? ""}`;
  const isBilling = /billing|quota|insufficient|credit|payment|spent|limit.*hard/i.test(
    haystack,
  );
  const isRateLimit = status === 429 || /rate.?limit/i.test(haystack);
  const isAuth =
    status === 401 || /api key|unauthorized|incorrect api key|authentication/i.test(haystack);

  return { status, message, code, type, isBilling, isRateLimit, isAuth };
}

function formatUserError(info: OpenAiErrorInfo): string {
  if (info.isAuth) {
    return "Clé OpenAI invalide. Vérifiez OPENAI_API_KEY dans .env.local.";
  }
  if (info.isBilling) {
    return [
      "Votre compte OpenAI n'a pas assez de crédit pour l'édition d'image.",
      "Allez sur platform.openai.com → Settings → Billing, ajoutez un moyen de paiement / des crédits,",
      "puis vérifiez que l'accès aux modèles Image (gpt-image) est activé.",
      "Astuce FasoBar : utilisez OPENAI_IMAGE_MODEL=gpt-image-1-mini et OPENAI_IMAGE_QUALITY=medium pour réduire le coût.",
    ].join(" ");
  }
  if (info.isRateLimit) {
    return "Limite de requêtes OpenAI atteinte. Réessayez dans un instant.";
  }
  return info.message;
}

async function requestOpenAiEdit(params: {
  apiKey: string;
  model: string;
  quality: string;
  prompt: string;
  image: Blob;
  filename: string;
}): Promise<{ ok: true; raw: string } | { ok: false; error: OpenAiErrorInfo }> {
  const form = new FormData();
  form.append("model", params.model);
  form.append("prompt", params.prompt);
  form.append("image", params.image, params.filename);
  form.append("input_fidelity", "high");
  form.append("quality", params.quality);
  form.append("size", "1024x1024");
  form.append("output_format", "png");

  const response = await fetch(OPENAI_IMAGES_EDIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: form,
  });

  const raw = await response.text();
  if (!response.ok) {
    return { ok: false, error: parseOpenAiError(response.status, raw) };
  }
  return { ok: true, raw };
}

function decodeOpenAiPayload(
  raw: string,
  scene: ProductImageScene,
  model: string,
): AiEnhanceProductImageResult | Promise<AiEnhanceProductImageResult> {
  let payload: {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    throw new Error("Réponse OpenAI illisible.");
  }

  const first = payload.data?.[0];
  if (!first) {
    throw new Error("Aucune image renvoyée par le modèle IA.");
  }

  if (first.b64_json) {
    return {
      bytes: Buffer.from(first.b64_json, "base64"),
      mimeType: "image/png",
      scene,
      sceneLabel: PRODUCT_IMAGE_SCENE_LABELS[scene],
      model,
    };
  }

  if (first.url) {
    return (async () => {
      const imageResponse = await fetch(first.url!);
      if (!imageResponse.ok) {
        throw new Error("Impossible de télécharger l'image générée par OpenAI.");
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      const contentType = imageResponse.headers.get("content-type") || "image/png";
      const resolvedMime =
        contentType.includes("jpeg")
          ? "image/jpeg"
          : contentType.includes("webp")
            ? "image/webp"
            : "image/png";
      return {
        bytes: Buffer.from(arrayBuffer),
        mimeType: resolvedMime,
        scene,
        sceneLabel: PRODUCT_IMAGE_SCENE_LABELS[scene],
        model,
      } as AiEnhanceProductImageResult;
    })();
  }

  throw new Error("Réponse OpenAI sans image utilisable.");
}

/**
 * Envoie la photo originale au modèle OpenAI Images Edit et retourne
 * une vraie image commerciale générée (pas de composition Canvas locale).
 * En cas de quota sur un modèle coûteux, retente automatiquement avec gpt-image-1-mini.
 */
export async function enhanceProductImageWithAi(
  input: AiEnhanceProductImageInput,
): Promise<AiEnhanceProductImageResult> {
  if (!input.image || input.image.size === 0) {
    throw new Error("Aucune image à améliorer.");
  }
  if (input.image.size > MAX_INPUT_BYTES) {
    throw new Error("Image trop lourde pour l'édition IA (max. 8 Mo).");
  }

  const apiKey = resolveApiKey();
  const preferredModel = resolveModel();
  const preferredQuality = resolveQuality();
  const scene = inferProductImageScene({
    categoryName: input.categoryName,
    productName: input.productName,
    departmentCode: input.departmentCode,
  });
  const prompt = buildProductImageEditPrompt({
    scene,
    productName: input.productName,
    categoryName: input.categoryName,
    backgroundVariant: input.backgroundVariant,
    regenerate: input.regenerate,
  });

  const mimeType = input.image.type || "image/png";
  const filename = `product-original.${extensionForMime(mimeType)}`;

  const attempts: Array<{ model: string; quality: string }> = [
    { model: preferredModel, quality: preferredQuality },
  ];

  if (preferredModel !== FALLBACK_MODEL || preferredQuality !== "medium") {
    attempts.push({ model: FALLBACK_MODEL, quality: "medium" });
  }
  if (preferredModel !== FALLBACK_MODEL || preferredQuality !== "low") {
    attempts.push({ model: FALLBACK_MODEL, quality: "low" });
  }

  // Déduplique les tentatives identiques
  const seen = new Set<string>();
  const uniqueAttempts = attempts.filter((attempt) => {
    const key = `${attempt.model}:${attempt.quality}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let lastBillingError: OpenAiErrorInfo | null = null;

  for (const attempt of uniqueAttempts) {
    const result = await requestOpenAiEdit({
      apiKey,
      model: attempt.model,
      quality: attempt.quality,
      prompt,
      image: input.image,
      filename,
    });

    if (result.ok) {
      return await decodeOpenAiPayload(result.raw, scene, attempt.model);
    }

    console.warn(
      `[enhanceProductImageWithAi] échec ${attempt.model}/${attempt.quality}:`,
      result.error.message,
      result.error.code,
    );

    if (result.error.isAuth) {
      throw new Error(formatUserError(result.error));
    }

    if (result.error.isBilling) {
      lastBillingError = result.error;
      continue;
    }

    // Autre erreur (validation modèle, etc.) : si ce n'est pas la dernière tentative, on continue
    if (attempt !== uniqueAttempts[uniqueAttempts.length - 1]) {
      continue;
    }

    throw new Error(formatUserError(result.error));
  }

  throw new Error(
    formatUserError(
      lastBillingError ?? {
        status: 402,
        message: "Quota OpenAI insuffisant.",
        isBilling: true,
        isRateLimit: false,
        isAuth: false,
      },
    ),
  );
}

export function isAiImageEnhancementConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
