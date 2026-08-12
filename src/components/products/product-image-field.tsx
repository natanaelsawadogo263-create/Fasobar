"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

export type ProductImageAssets = {
  file: File | null;
};

type ProductImageFieldProps = {
  existingUrl?: string | null;
  onAssetsChange: (assets: ProductImageAssets) => void;
  compact?: boolean;
};

function revokeIfBlob(url: string | null) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function ProductImageField({
  existingUrl,
  onAssetsChange,
  compact = false,
}: ProductImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onAssetsChangeRef = useRef(onAssetsChange);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  const displayUrl = preview ?? (cleared ? null : existingUrl ?? null);

  useEffect(() => {
    onAssetsChangeRef.current = onAssetsChange;
  }, [onAssetsChange]);

  useEffect(() => {
    onAssetsChangeRef.current({ file });
  }, [file]);

  useEffect(() => {
    return () => revokeIfBlob(preview);
  }, [preview]);

  function handleFileChange(fileList: FileList | null) {
    const next = fileList?.[0];
    if (!next) return;

    revokeIfBlob(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setCleared(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function clearImage() {
    revokeIfBlob(preview);
    setFile(null);
    setPreview(null);
    setCleared(true);
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 ${
          compact ? "h-20 w-20" : "h-28 w-28"
        }`}
      >
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt="Photo produit"
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-center">
            <ImagePlus className="h-5 w-5 text-slate-300" />
            <p className="text-[9px] leading-tight text-slate-400">Aucune</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-800 px-3 text-[11px] font-semibold text-white hover:bg-slate-700 ${
            compact ? "h-9" : "min-h-11"
          }`}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {displayUrl ? "Changer" : "Ajouter"}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/*"
            className="hidden"
            onChange={(event) => handleFileChange(event.target.files)}
          />
        </label>

        {displayUrl ? (
          <button
            type="button"
            onClick={clearImage}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[11px] font-medium text-slate-600 hover:bg-slate-50 ${
              compact ? "h-9" : "min-h-11"
            }`}
          >
            <X className="h-3.5 w-3.5" />
            Retirer
          </button>
        ) : null}
      </div>
    </div>
  );
}
