import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Mirrors the Windows file-URL rule used by desktop/main/windows.ts:
 * never build file:/// + raw Windows path (backslashes → ERR_FAILED).
 */
function toSafeFileUrl(absolutePath: string): string {
  return pathToFileURL(path.resolve(absolutePath)).toString();
}

describe("renderer local file URLs (Windows-safe)", () => {
  it("converts absolute Windows-style paths without backslashes in the URL", () => {
    const fake = path.join(
      "C:",
      "Users",
      "HP745G6",
      "AppData",
      "Local",
      "Programs",
      "FasoBar",
      "resources",
      "renderer",
      "splash.html",
    );
    const url = toSafeFileUrl(fake);
    expect(url.startsWith("file:")).toBe(true);
    expect(url.includes("\\")).toBe(false);
    expect(url).toContain("splash.html");
    // Broken form that caused ERR_FAILED (-2) on NSIS installs:
    expect(url).not.toMatch(/^file:\/\/\/[A-Za-z]:\\/);
  });

  it("repo renderer HTML files exist and are readable", () => {
    const dir = path.join(process.cwd(), "desktop", "renderer");
    for (const name of ["splash.html", "setup.html", "error.html"]) {
      const full = path.join(dir, name);
      expect(fs.existsSync(full), full).toBe(true);
      const url = toSafeFileUrl(full);
      expect(url.includes("\\")).toBe(false);
      expect(fs.readFileSync(full, "utf8").length).toBeGreaterThan(50);
    }
  });

  it("tmp file round-trip path is loadable as file URL", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fasobar-renderer-"));
    const file = path.join(tmp, "splash.html");
    fs.writeFileSync(file, "<!doctype html><title>ok</title>", "utf8");
    const url = toSafeFileUrl(file);
    expect(url.startsWith("file:")).toBe(true);
    expect(url.includes("\\")).toBe(false);
    expect(fs.existsSync(file)).toBe(true);
    expect(url).toContain("splash.html");
  });
});
