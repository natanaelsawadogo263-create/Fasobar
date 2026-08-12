import { describe, expect, it } from "vitest";

import {
  desktopHealthSchema,
  isForbiddenSecretContent,
  normalizeServerUrl,
  parseDesktopConfig,
  safeParseDesktopConfig,
  serverPortSchema,
  serverUrlSchema,
} from "./config-schema";

describe("serverPortSchema", () => {
  it("accepte le port par défaut", () => {
    expect(serverPortSchema.parse(3180)).toBe(3180);
  });

  it("refuse un port trop bas", () => {
    expect(serverPortSchema.safeParse(80).success).toBe(false);
  });
});

describe("serverUrlSchema", () => {
  it("accepte une IP LAN", () => {
    expect(serverUrlSchema.safeParse("http://192.168.1.10:3180").success).toBe(
      true,
    );
  });

  it("accepte localhost", () => {
    expect(serverUrlSchema.safeParse("http://127.0.0.1:3180").success).toBe(
      true,
    );
  });

  it("rejette une URL distante https", () => {
    expect(
      serverUrlSchema.safeParse("https://example.com").success,
    ).toBe(false);
  });

  it("rejette un domaine public http", () => {
    expect(
      serverUrlSchema.safeParse("http://google.com:3180").success,
    ).toBe(false);
  });
});

describe("normalizeServerUrl", () => {
  it("ajoute http et retire le slash final", () => {
    expect(normalizeServerUrl("192.168.1.10:3180/")).toBe(
      "http://192.168.1.10:3180",
    );
  });
});

describe("desktopConfigSchema", () => {
  const valid = {
    installationMode: "SERVEUR_CAISSE" as const,
    serverPort: 3180,
    serverUrl: null,
    installationId: "11111111-1111-4111-8111-111111111111",
    appVersion: "0.1.0",
  };

  it("parse une config valide", () => {
    expect(parseDesktopConfig(valid).installationMode).toBe("SERVEUR_CAISSE");
  });

  it("refuse une config corrompue", () => {
    expect(safeParseDesktopConfig({ ...valid, installationMode: "X" }).success).toBe(
      false,
    );
  });
});

describe("desktopHealthSchema", () => {
  it("accepte une réponse health FasoBar", () => {
    const result = desktopHealthSchema.safeParse({
      status: "ok",
      app: "FasoBar",
      version: "0.1.0",
      mode: "desktop",
    });
    expect(result.success).toBe(true);
  });

  it("rejette une réponse étrangère", () => {
    expect(
      desktopHealthSchema.safeParse({
        status: "ok",
        app: "Other",
        version: "1",
        mode: "desktop",
      }).success,
    ).toBe(false);
  });
});

describe("isForbiddenSecretContent", () => {
  it("détecte SUPABASE_SECRET_KEY", () => {
    expect(isForbiddenSecretContent('SUPABASE_SECRET_KEY="abc"')).toBe(true);
  });

  it("laisse passer les clés publiques", () => {
    expect(
      isForbiddenSecretContent("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=pk"),
    ).toBe(false);
  });
});
