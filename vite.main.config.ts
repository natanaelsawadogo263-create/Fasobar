import { defineConfig } from "vite";

/**
 * Forge Vite packages only the bundled main/preload output into app.asar —
 * it does not ship node_modules for Rollup "external" packages.
 * Keep electron + node builtins external; bundle every npm dependency
 * (including electron-squirrel-startup) into main.js.
 */
export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron", /^node:/],
    },
  },
});
