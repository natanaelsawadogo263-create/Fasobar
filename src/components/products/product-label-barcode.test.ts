// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import JsBarcode from "jsbarcode";

/**
 * Vérifie que jsbarcode encode réellement en Code 128 (vraies barres, pas un
 * algorithme maison) — aussi bien un code numérique (EAN) qu'un code alphanumérique
 * (chaque produit garde son propre code, saisi ou scanné, jamais généré par FasoBar).
 */
function renderToSvg(value: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, {
    format: "CODE128",
    displayValue: false,
    margin: 0,
    width: 1.3,
    height: 26,
  });
  return svg;
}

describe("rendu Code 128 (jsbarcode) pour l'étiquette produit", () => {
  it("encode un code fabricant numérique (EAN) sans lever d'erreur", () => {
    const svg = renderToSvg("5449000000996");
    expect(svg.querySelectorAll("rect, path").length).toBeGreaterThan(0);
  });

  it("encode un code alphanumérique (ex. référence fournisseur)", () => {
    const svg = renderToSvg("REF-A1234");
    expect(svg.querySelectorAll("rect, path").length).toBeGreaterThan(0);
  });

  it("produit des rendus différents pour deux valeurs différentes (pas un motif figé)", () => {
    const svgA = renderToSvg("111111111111");
    const svgB = renderToSvg("222222222222");
    expect(svgA.innerHTML).not.toBe(svgB.innerHTML);
  });
});
