/**
 * Rend un bloc de données structurées JSON-LD. Échappe `<` pour éviter toute
 * injection XSS via JSON.stringify (recommandation officielle Next.js).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
