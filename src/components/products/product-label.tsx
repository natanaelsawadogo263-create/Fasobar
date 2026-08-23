"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import JsBarcode from "jsbarcode";
import { Printer, X } from "lucide-react";

import { formatPriceXof } from "@/lib/products/constants";
import { printProductLabel } from "@/lib/products/print-product-label";

type ProductLabelProps = {
  productName: string;
  sellingPrice: number;
  barcode: string | null;
  establishmentName: string;
  returnTo: string;
  autoPrint?: boolean;
};

/**
 * Étiquette produit imprimable (nom, prix, vraies barres Code 128, valeur en texte)
 * — 50 x 30 mm. Rendu via jsbarcode (bibliothèque dédiée, pas d'algorithme maison) ;
 * mécanisme d'impression séparé du ticket de caisse (print-product-label.ts).
 */
export function ProductLabel({
  productName,
  sellingPrice,
  barcode,
  establishmentName,
  returnTo,
  autoPrint = false,
}: ProductLabelProps) {
  const router = useRouter();
  const autoPrintStartedRef = useRef(false);
  const barcodeSvgRef = useRef<SVGSVGElement>(null);
  const barcodeWarningRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!barcode || !barcodeSvgRef.current) return;
    try {
      JsBarcode(barcodeSvgRef.current, barcode, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        width: 1.3,
        height: 26,
        background: "#ffffff",
        lineColor: "#000000",
      });
      if (barcodeWarningRef.current) barcodeWarningRef.current.hidden = true;
    } catch {
      // Caractère hors du jeu Code 128 (rare) — le code reste lisible en texte.
      // Mise à jour DOM directe (pas de setState) : jsbarcode est lui-même un système
      // externe au rendu React, l'effet ne fait que le synchroniser.
      if (barcodeWarningRef.current) barcodeWarningRef.current.hidden = false;
    }
  }, [barcode]);

  useEffect(() => {
    if (!autoPrint || autoPrintStartedRef.current) return;
    autoPrintStartedRef.current = true;
    printProductLabel();
  }, [autoPrint]);

  return (
    <div className="flex min-h-dvh flex-col items-center bg-slate-100 px-4 py-6">
      <div className="no-print flex w-full max-w-sm items-center justify-between gap-2 pb-4">
        <button
          type="button"
          onClick={() => router.push(returnTo)}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
        >
          <X className="h-4 w-4" />
          Fermer
        </button>
        <button
          type="button"
          onClick={() => printProductLabel()}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-[13px] font-semibold text-white"
        >
          <Printer className="h-4 w-4" />
          Imprimer l’étiquette
        </button>
      </div>

      <div className="product-label flex w-[50mm] flex-col items-center justify-between rounded-lg border border-slate-300 bg-white p-2 text-center shadow-sm">
        <p className="line-clamp-2 w-full text-[9px] font-semibold leading-tight text-slate-900">
          {productName}
        </p>
        <p className="text-[13px] font-bold tabular-nums text-slate-900">
          {formatPriceXof(sellingPrice)}
        </p>
        {barcode ? (
          <div className="w-full">
            <svg ref={barcodeSvgRef} className="mx-auto block w-full" role="img" aria-label={`Code-barres ${barcode}`} />
            <p ref={barcodeWarningRef} hidden className="text-[7px] text-amber-600">
              Barres non générées — code ci-dessous
            </p>
            <p className="mt-0.5 break-all font-mono text-[9px] text-slate-800">{barcode}</p>
          </div>
        ) : (
          <p className="text-[8px] text-slate-400">Sans code-barres</p>
        )}
        <p className="w-full truncate text-[7px] text-slate-400">{establishmentName}</p>
      </div>
    </div>
  );
}
