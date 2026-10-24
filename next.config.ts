import type { NextConfig } from "next";

const supabaseHostname = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

/**
 * Do NOT list `node:sqlite` in serverExternalPackages.
 * Turbopack treats `node:` builtins listed there as URL externals and replaces
 * `require("node:sqlite")` with a MODULE_NOT_FOUND stub:
 *   "Unsupported external type Url for commonjs reference"
 *
 * Desktop standalone builds use Webpack (`next build --webpack`) so Node resolves
 * the builtin natively. The default `next build` (Turbopack) stays for web —
 * `turbopack: {}` acknowledges the webpack hook without migrating it.
 */
/**
 * En-têtes de sécurité appliqués à toutes les réponses.
 * - frame-ancestors / X-Frame-Options : anti-clickjacking (seule l'app peut
 *   s'encadrer elle-même — iframe d'impression des additions).
 * - object-src / base-uri / form-action : bloque les vecteurs d'injection
 *   classiques sans restreindre les scripts (pas de régression sur Next/Supabase).
 * - HSTS : ignoré par les navigateurs en HTTP, donc sans effet sur le serveur
 *   desktop en LAN ; force HTTPS sur le domaine public.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Ne pas annoncer la techno serveur (en-tête X-Powered-By: Next.js).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Keep default `next build` on Turbopack when a webpack() hook is present
  // (Next 16 otherwise errors). Desktop uses `next build --webpack` instead.
  turbopack: {},
  // Navigations client : réutilise le payload RSC plus longtemps (app plus fluide).
  experimental: {
    staleTimes: {
      dynamic: 300,
      static: 600,
    },
    // Photos produit (téléphone) dépassent souvent 1 Mo en multipart.
    serverActions: {
      bodySizeLimit: "8mb",
    },
    // Rappels de mise à jour Next.js : uniquement pour les correctifs de sécurité.
    agentUpgrade: "security",
  },
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },
  // Webpack desktop builds: keep node:sqlite as a real Node builtin require.
  webpack: (config, { isServer }) => {
    if (isServer) {
      const previous = config.externals;
      config.externals = [
        ...(Array.isArray(previous)
          ? previous
          : previous
            ? [previous]
            : []),
        ({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
          if (request === "node:sqlite" || request === "sqlite") {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
