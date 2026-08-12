import { afterEach, describe, expect, it } from "vitest";

import { getDesktopDownloadUrl, getDesktopPublicVersion } from "@/lib/marketing/config";
import { FALLBACK_PUBLIC_PLANS } from "@/lib/marketing/plan-constants";

describe("téléchargement public Desktop", () => {
  const previousUrl = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL;
  const previousVersion = process.env.NEXT_PUBLIC_DESKTOP_APP_VERSION;

  afterEach(() => {
    if (previousUrl === undefined) {
      delete process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL;
    } else {
      process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL = previousUrl;
    }

    if (previousVersion === undefined) {
      delete process.env.NEXT_PUBLIC_DESKTOP_APP_VERSION;
    } else {
      process.env.NEXT_PUBLIC_DESKTOP_APP_VERSION = previousVersion;
    }
  });

  it("accepte une URL HTTPS publique", () => {
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL =
      "https://downloads.fasobar.com/FasoBar-Setup.exe";
    expect(getDesktopDownloadUrl()).toBe(
      "https://downloads.fasobar.com/FasoBar-Setup.exe",
    );
  });

  it("refuse un chemin Windows local", () => {
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL =
      "C:\\projet-dev\\maquis-gestion\\desktop\\out\\FasoBar-Setup.exe";
    expect(getDesktopDownloadUrl()).toBeNull();
  });

  it("refuse une URL file://", () => {
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL = "file:///C:/FasoBar-Setup.exe";
    expect(getDesktopDownloadUrl()).toBeNull();
  });

  it("expose une version publique", () => {
    process.env.NEXT_PUBLIC_DESKTOP_APP_VERSION = "1.2.3";
    expect(getDesktopPublicVersion()).toBe("1.2.3");
  });
});

describe("offres publiques", () => {
  it("reprend les tarifs seed FasoBar", () => {
    expect(FALLBACK_PUBLIC_PLANS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MONTHLY", priceXof: 10_000 }),
        expect.objectContaining({ code: "YEARLY", priceXof: 100_000 }),
      ]),
    );
  });
});
