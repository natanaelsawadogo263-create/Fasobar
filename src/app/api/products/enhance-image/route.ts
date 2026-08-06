import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { enhanceProductImageWithAi } from "@/lib/products/ai-enhance-product-image";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

function readOptionalString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
    }

    const workspace = await getWorkspaceContext(user.id);
    if (!workspace?.canManageProducts) {
      return NextResponse.json(
        { error: "Droits insuffisants pour améliorer une image produit." },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json(
        { error: "Ajoutez d'abord une image originale à améliorer." },
        { status: 400 },
      );
    }

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (image.type && !allowed.includes(image.type)) {
      return NextResponse.json(
        { error: "Format non supporté. Utilisez PNG, JPG ou WebP." },
        { status: 400 },
      );
    }

    const backgroundVariant = Number(readOptionalString(formData, "backgroundVariant") || "0");
    const regenerate = readOptionalString(formData, "regenerate") === "1";

    const result = await enhanceProductImageWithAi({
      image,
      productName: readOptionalString(formData, "productName"),
      categoryName: readOptionalString(formData, "categoryName"),
      departmentCode: readOptionalString(formData, "departmentCode") || "BAR",
      backgroundVariant: Number.isFinite(backgroundVariant) ? backgroundVariant : 0,
      regenerate,
    });

    return NextResponse.json({
      imageBase64: result.bytes.toString("base64"),
      mimeType: result.mimeType,
      scene: result.scene,
      sceneLabel: result.sceneLabel,
      model: result.model,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d'améliorer l'image via l'IA.";
    const isConfig = /OPENAI_API_KEY|Clé OpenAI/i.test(message);
    const isBilling = /crédit|billing|quota|paiement/i.test(message);
    if (!isBilling) {
      console.error("[POST /api/products/enhance-image]", error);
    } else {
      console.warn("[POST /api/products/enhance-image]", message);
    }
    const status = isConfig ? 503 : isBilling ? 402 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
