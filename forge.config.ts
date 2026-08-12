import type { ForgeConfig } from "@electron-forge/shared-types";
import { VitePlugin } from "@electron-forge/plugin-vite";
import path from "node:path";

const config: ForgeConfig = {
  packagerConfig: {
    name: "FasoBar",
    executableName: "FasoBar",
    asar: true,
    appBundleId: "com.fasobar.desktop",
    // electron-packager appends .ico on Windows → build/icon.ico (multi-res).
    icon: path.resolve(__dirname, "build/icon"),
    win32metadata: {
      CompanyName: "FasoBar",
      FileDescription: "FasoBar",
      ProductName: "FasoBar",
      InternalName: "FasoBar",
      OriginalFilename: "FasoBar.exe",
    },
    extraResource: [
      path.resolve(__dirname, "desktop/resources/next-app"),
      path.resolve(__dirname, "desktop/renderer"),
      path.resolve(__dirname, "desktop/assets"),
    ],
  },
  rebuildConfig: {},
  // Production installer is NSIS via electron-builder (see electron-builder.yml).
  // Forge makers kept empty to avoid shipping Squirrel/NuGet setups.
  makers: [],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "desktop/main/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "desktop/preload/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [],
    }),
  ],
};

export default config;
