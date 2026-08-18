import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FasoBar — Gestion stocks & caisse",
    short_name: "FasoBar",
    description:
      "Caisse, stock, tickets et reçus pour votre établissement.",
    start_url: "/connexion",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#07110e",
    theme_color: "#0b1220",
    lang: "fr",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/brand/fasobar-logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/fasobar-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/fasobar-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
