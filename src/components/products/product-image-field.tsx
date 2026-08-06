"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

import {
  inferProductImageScene,
  PRODUCT_IMAGE_SCENE_LABELS,
  type ProductImageScene,
} from "@/lib/products/product-image-scenes";

export type ProductImageSelection = "original" | "optimized";

export type ProductImageAssets = {
  originalFile: File | null;
  optimizedFile: File | null;
  selection: ProductImageSelection;
};

type ProductImageFieldProps = {
  existingOriginalUrl?: string | null;
  existingOptimizedUrl?: string | null;
  productName?: string;
  categoryName?: string;
  departmentCode?: string;
  onAssetsChange: (assets: ProductImageAssets) => void;
};

type EnhanceApiSuccess = {
  imageBase64: string;
  mimeType: string;
  scene: ProductImageScene;
  sceneLabel: string;
  model: string;
};

function revokeIfBlob(url: string | null) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

async function blobFromUrl(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Impossible de charger l'image originale.");
  }
  return response.blob();
}

async function callEnhanceApi(input: {
  source: Blob;
  productName: string;
  categoryName: string;
  departmentCode: string;
  backgroundVariant: number;
  regenerate: boolean;
  onProgress?: (ratio: number, label: string) => void;
}): Promise<{ ok: true; data: EnhanceApiSuccess } | { ok: false; error: string }> {
  input.onProgress?.(0.12, "Envoi de la photo originale au modèle IA…");

  const formData = new FormData();
  const mime = input.source.type || "image/png";
  const extension = mime.includes("webp") ? "webp" : mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
  formData.set(
    "image",
    new File([input.source], `product-original.${extension}`, { type: mime }),
  );
  formData.set("productName", input.productName);
  formData.set("categoryName", input.categoryName);
  formData.set("departmentCode", input.departmentCode);
  formData.set("backgroundVariant", String(input.backgroundVariant));
  formData.set("regenerate", input.regenerate ? "1" : "0");

  input.onProgress?.(0.35, "Édition IA en cours (netteté, lumière, mise en scène)…");

  const response = await fetch("/api/products/enhance-image", {
    method: "POST",
    body: formData,
  });

  input.onProgress?.(0.85, "Réception de l'image commerciale…");

  let payload: EnhanceApiSuccess & { error?: string };
  try {
    payload = (await response.json()) as EnhanceApiSuccess & { error?: string };
  } catch {
    return { ok: false, error: "Réponse serveur illisible." };
  }

  if (!response.ok || payload.error || !payload.imageBase64) {
    return { ok: false, error: payload.error || "Échec de l'amélioration IA." };
  }

  return { ok: true, data: payload };
}

function fileFromBase64(base64: string, mimeType: string, filename: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mimeType || "image/png" });
}

export function ProductImageField({
  existingOriginalUrl,
  existingOptimizedUrl,
  productName = "",
  categoryName = "",
  departmentCode = "BAR",
  onAssetsChange,
}: ProductImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onAssetsChangeRef = useRef(onAssetsChange);
  onAssetsChangeRef.current = onAssetsChange;

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [optimizedFile, setOptimizedFile] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [optimizedPreview, setOptimizedPreview] = useState<string | null>(null);
  const [selection, setSelection] = useState<ProductImageSelection>(
    existingOptimizedUrl ? "optimized" : "original",
  );
  const [status, setStatus] = useState<"idle" | "processing" | "ready" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [bgVariant, setBgVariant] = useState(0);
  const [scene, setScene] = useState<ProductImageScene>(() =>
    inferProductImageScene({ categoryName, productName, departmentCode }),
  );
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  const displayOriginal = originalPreview ?? existingOriginalUrl ?? null;
  const displayOptimized = optimizedPreview ?? existingOptimizedUrl ?? null;

  useEffect(() => {
    setScene(inferProductImageScene({ categoryName, productName, departmentCode }));
  }, [categoryName, productName, departmentCode]);

  useEffect(() => {
    onAssetsChangeRef.current({
      originalFile,
      optimizedFile,
      selection,
    });
  }, [originalFile, optimizedFile, selection]);

  useEffect(() => {
    return () => {
      revokeIfBlob(originalPreview);
      revokeIfBlob(optimizedPreview);
    };
  }, [originalPreview, optimizedPreview]);

  function emitMessage(text: string, nextStatus: typeof status = "ready") {
    setMessage(text);
    setStatus(nextStatus);
  }

  async function resolveOriginalBlob(): Promise<Blob> {
    if (originalFile) {
      return originalFile;
    }
    if (!displayOriginal) {
      throw new Error("Ajoutez d'abord une image produit.");
    }
    return blobFromUrl(displayOriginal);
  }

  async function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    revokeIfBlob(originalPreview);
    revokeIfBlob(optimizedPreview);

    const preview = URL.createObjectURL(file);
    setOriginalFile(file);
    setOriginalPreview(preview);
    setOptimizedFile(null);
    setOptimizedPreview(null);
    setSelection("original");
    setBgVariant(0);
    setModelUsed(null);
    setStatus("idle");
    setMessage(
      "Image originale conservée. Cliquez sur « Améliorer l'image » pour l'édition IA.",
    );
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function runAiEnhance(regenerate: boolean) {
    setStatus("processing");
    setProgress(0.05);
    setMessage(
      regenerate
        ? "Régénération IA du fond et de la mise en scène…"
        : "Préparation de l'édition IA…",
    );

    try {
      const source = await resolveOriginalBlob();
      const nextVariant = regenerate ? bgVariant + 1 : bgVariant;
      if (regenerate) {
        setBgVariant(nextVariant);
      }

      const result = await callEnhanceApi({
        source,
        productName,
        categoryName,
        departmentCode,
        backgroundVariant: nextVariant,
        regenerate,
        onProgress: (ratio, label) => {
          setProgress(ratio);
          setMessage(label);
        },
      });

      if (!result.ok) {
        emitMessage(result.error, "error");
        setProgress(0);
        return;
      }

      const data = result.data;
      const optimized = fileFromBase64(
        data.imageBase64,
        data.mimeType,
        "product-optimized.png",
      );
      const nextPreview = URL.createObjectURL(optimized);
      revokeIfBlob(optimizedPreview);
      setOptimizedFile(optimized);
      setOptimizedPreview(nextPreview);
      setScene(data.scene);
      setModelUsed(data.model);
      setSelection("optimized");
      setProgress(1);
      emitMessage(
        regenerate
          ? `Nouveau fond IA « ${data.sceneLabel} » généré (${data.model}). Validez pour le catalogue.`
          : `Image IA prête — fond « ${data.sceneLabel} » (${data.model}). Comparez puis validez.`,
      );
    } catch (error) {
      emitMessage(
        error instanceof Error
          ? error.message
          : "Échec de l'amélioration IA. Réessayez avec une photo claire.",
        "error",
      );
      setProgress(0);
    }
  }

  function useOriginal() {
    if (!displayOriginal) {
      emitMessage("Aucune image originale disponible.", "error");
      return;
    }
    setSelection("original");
    emitMessage("Image originale sélectionnée pour le catalogue.");
  }

  function validateOptimized() {
    if (!displayOptimized && !optimizedFile) {
      emitMessage("Générez d'abord une image IA optimisée.", "error");
      return;
    }
    setSelection("optimized");
    emitMessage(
      "Image optimisée validée — elle sera utilisée sur les cartes produit.",
    );
  }

  function clearImage() {
    revokeIfBlob(originalPreview);
    revokeIfBlob(optimizedPreview);
    setOriginalFile(null);
    setOptimizedFile(null);
    setOriginalPreview(null);
    setOptimizedPreview(null);
    setSelection("original");
    setStatus("idle");
    setMessage(null);
    setProgress(0);
    setBgVariant(0);
    setModelUsed(null);
  }

  const hasAnyImage = Boolean(displayOriginal || displayOptimized);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] font-semibold text-slate-800">Images produit FasoBar</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
          L&apos;originale est conservée. « Améliorer l&apos;image » envoie la photo à un vrai
          modèle d&apos;édition IA (netteté, lumière, fond réaliste adapté — détecté :{" "}
          {PRODUCT_IMAGE_SCENE_LABELS[scene]}
          {modelUsed ? ` · ${modelUsed}` : ""}).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PreviewCard
          title="Originale"
          subtitle="Photo uploadée"
          url={displayOriginal}
          selected={selection === "original" && Boolean(displayOriginal)}
          emptyLabel="Pas encore d'originale"
        />
        <PreviewCard
          title="Optimisée IA"
          subtitle={PRODUCT_IMAGE_SCENE_LABELS[scene]}
          url={displayOptimized}
          selected={selection === "optimized" && Boolean(displayOptimized)}
          emptyLabel="Pas encore d'optimisée"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold text-white ${
            status === "processing" ? "bg-slate-400" : "bg-slate-800 hover:bg-slate-700"
          }`}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {hasAnyImage ? "Changer l'image" : "Ajouter une image"}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/*"
            className="hidden"
            disabled={status === "processing"}
            onChange={(event) => void handleFileChange(event.target.files)}
          />
        </label>

        <ActionButton
          disabled={status === "processing" || !displayOriginal}
          onClick={() => void runAiEnhance(false)}
          tone="emerald"
          icon={
            status === "processing" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )
          }
          label={status === "processing" ? "Édition IA…" : "Améliorer l'image"}
        />

        <ActionButton
          disabled={status === "processing" || !displayOriginal}
          onClick={() => void runAiEnhance(true)}
          tone="slate"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          label="Régénérer le fond"
        />

        <ActionButton
          disabled={status === "processing" || !displayOriginal}
          onClick={useOriginal}
          tone="slate"
          icon={<ImagePlus className="h-3.5 w-3.5" />}
          label="Utiliser l'image originale"
        />

        <ActionButton
          disabled={status === "processing" || !displayOptimized}
          onClick={validateOptimized}
          tone="emerald"
          icon={<Check className="h-3.5 w-3.5" />}
          label="Valider l'image optimisée"
        />

        {hasAnyImage && status !== "processing" ? (
          <button
            type="button"
            onClick={clearImage}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <X className="h-3.5 w-3.5" />
            Retirer
          </button>
        ) : null}
      </div>

      {status === "processing" ? (
        <div className="space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
            />
          </div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {message}
          </p>
        </div>
      ) : message ? (
        <p
          className={`text-[11px] font-medium ${
            status === "error" ? "text-red-600" : "text-emerald-700"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function PreviewCard({
  title,
  subtitle,
  url,
  selected,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  url: string | null;
  selected: boolean;
  emptyLabel: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border ${
        selected
          ? "border-emerald-500 ring-2 ring-emerald-500/20"
          : "border-slate-200"
      } bg-white shadow-sm`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div>
          <p className="text-[11px] font-semibold text-slate-800">{title}</p>
          <p className="text-[10px] text-slate-500">{subtitle}</p>
        </div>
        {selected ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Sélectionnée
          </span>
        ) : null}
      </div>
      <div className="relative h-40 bg-slate-50">
        {url ? (
          <Image src={url} alt={title} fill className="object-contain p-3" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-slate-400">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  tone,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "emerald" | "slate";
  icon: ReactNode;
}) {
  const classes =
    tone === "emerald"
      ? "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-300"
      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition ${classes}`}
    >
      {icon}
      {label}
    </button>
  );
}
