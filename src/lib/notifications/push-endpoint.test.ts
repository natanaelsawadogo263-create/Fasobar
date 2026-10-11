import { describe, expect, it } from "vitest";

import { isAllowedPushEndpoint, isValidPushKey } from "@/lib/notifications/push-endpoint";

describe("isAllowedPushEndpoint", () => {
  it("accepte les services push des navigateurs", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(
      isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc"),
    ).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(
      true,
    );
    expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
  });

  it("refuse les URL internes ou arbitraires (SSRF)", () => {
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isAllowedPushEndpoint("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedPushEndpoint("https://localhost:3000/api")).toBe(false);
    expect(isAllowedPushEndpoint("https://evil-fcm.googleapis.com.attacker.io/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://attackerfcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://user:pw@fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isAllowedPushEndpoint("pas une url")).toBe(false);
  });
});

describe("isValidPushKey", () => {
  it("accepte les clés base64url", () => {
    expect(isValidPushKey("BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM")).toBe(true);
  });

  it("refuse les valeurs suspectes", () => {
    expect(isValidPushKey("<script>")).toBe(false);
    expect(isValidPushKey("a".repeat(300))).toBe(false);
  });
});
