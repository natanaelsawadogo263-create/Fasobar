import { describe, expect, it } from "vitest";

import {
  getAuthRedirectOrigin,
  sanitizeAuthNextPath,
} from "@/lib/auth/redirect-origin";

describe("getAuthRedirectOrigin", () => {
  it("préfère NEXT_PUBLIC_SITE_URL", () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.fasobar.test/";
    try {
      expect(getAuthRedirectOrigin(new Headers({ host: "localhost:3000" }))).toBe(
        "https://app.fasobar.test",
      );
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = previous;
      }
    }
  });

  it("retombe sur les en-têtes Host", () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    const previousApp = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    try {
      expect(
        getAuthRedirectOrigin(
          new Headers({
            host: "localhost:3001",
            "x-forwarded-proto": "http",
          }),
        ),
      ).toBe("http://localhost:3001");
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = previous;
      }
      if (previousApp === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
      } else {
        process.env.NEXT_PUBLIC_APP_URL = previousApp;
      }
    }
  });
});

describe("sanitizeAuthNextPath", () => {
  it("accepte les chemins internes", () => {
    expect(sanitizeAuthNextPath("/nouveau-mot-de-passe")).toBe(
      "/nouveau-mot-de-passe",
    );
  });

  it("refuse les open redirects", () => {
    expect(sanitizeAuthNextPath("//evil.test")).toBe("/application");
    expect(sanitizeAuthNextPath("https://evil.test")).toBe("/application");
  });
});
