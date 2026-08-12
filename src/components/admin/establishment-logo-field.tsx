"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

type EstablishmentLogoFieldProps = {
  existingUrl?: string | null;
};

export function EstablishmentLogoField({
  existingUrl = null,
}: EstablishmentLogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setPreviewUrl(existingUrl);
    setRemoveLogo(false);
  }, [existingUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handlePick(file: File | null) {
    setLocalError(null);
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setLocalError("Logo trop lourd (max. 2 Mo).");
      return;
    }

    const allowed = ["image/png", "image/jpeg", "image/webp", "image/jpg"];
    if (file.type && !allowed.includes(file.type)) {
      setLocalError("Format non supporté. Utilisez PNG, JPG ou WebP.");
      return;
    }

    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setRemoveLogo(false);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemove() {
    setLocalError(null);
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setRemoveLogo(true);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[13px] font-semibold text-slate-900">Logo d&apos;impression</p>
        <p className="mt-0.5 text-[12px] text-slate-500">
          Affiché en en-tête des reçus et additions imprimés par la caisse. PNG, JPG ou
          WebP — 2 Mo max.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white">
          {previewUrl && !removeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local / URL publique
            <img
              src={previewUrl}
              alt="Logo établissement"
              className="max-h-full max-w-full object-contain p-1"
            />
          ) : (
            <ImagePlus className="h-6 w-6 text-slate-300" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
            <ImagePlus className="h-3.5 w-3.5" />
            {previewUrl && !removeLogo ? "Changer" : "Ajouter un logo"}
            <input
              ref={inputRef}
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => handlePick(event.target.files?.[0] ?? null)}
            />
          </label>

          {previewUrl && !removeLogo ? (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Retirer
            </button>
          ) : null}

          <input type="hidden" name="removeLogo" value={removeLogo ? "1" : "0"} />
          <input type="hidden" name="currentLogoUrl" value={existingUrl ?? ""} />
        </div>
      </div>

      {localError ? (
        <p className="text-[12px] font-medium text-red-700">{localError}</p>
      ) : null}
    </div>
  );
}
