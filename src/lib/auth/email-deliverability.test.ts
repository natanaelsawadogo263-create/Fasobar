import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isDisposableEmailDomain, isReservedEmailDomain } = await import(
  "@/lib/auth/email-deliverability"
);

describe("isDisposableEmailDomain", () => {
  it("bloque les services d'adresses jetables", () => {
    expect(isDisposableEmailDomain("yopmail.com")).toBe(true);
    expect(isDisposableEmailDomain("Mailinator.com")).toBe(true);
    expect(isDisposableEmailDomain("sub.guerrillamail.com")).toBe(true);
  });

  it("accepte les fournisseurs classiques", () => {
    expect(isDisposableEmailDomain("gmail.com")).toBe(false);
    expect(isDisposableEmailDomain("yahoo.fr")).toBe(false);
    expect(isDisposableEmailDomain("orange.bf")).toBe(false);
  });
});

describe("isReservedEmailDomain", () => {
  it("bloque les domaines d'exemple et de test", () => {
    expect(isReservedEmailDomain("example.com")).toBe(true);
    expect(isReservedEmailDomain("shop.test")).toBe(true);
    expect(isReservedEmailDomain("localhost")).toBe(true);
  });

  it("accepte les vrais domaines", () => {
    expect(isReservedEmailDomain("gmail.com")).toBe(false);
    expect(isReservedEmailDomain("fasobar.com")).toBe(false);
  });
});
