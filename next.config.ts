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
const nextConfig: NextConfig = {
  output: "standalone",
  // Keep default `next build` on Turbopack when a webpack() hook is present
  // (Next 16 otherwise errors). Desktop uses `next build --webpack` instead.
  turbopack: {},
  // Navigations client : réutilise brièvement le payload RSC (app plus réactive).
  experimental: {
    staleTimes: {
      dynamic: 120,
      static: 300,
    },
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
