import { describe, expect, it } from "vitest";
import { signPayload, verifySignature } from "./hmac";

describe("hmac", () => {
  const secret = "test-webhook-secret-value";
  const body = JSON.stringify({ gatewayEventId: "evt_1", amount: 1000 });

  it("accepts a signature produced with the correct secret", () => {
    const signature = signPayload(body, secret);
    expect(verifySignature(body, secret, signature)).toBe(true);
  });

  it("rejects a signature produced with a different secret", () => {
    const signature = signPayload(body, "a-completely-different-secret");
    expect(verifySignature(body, secret, signature)).toBe(false);
  });

  it("rejects when the body has been tampered with after signing", () => {
    const signature = signPayload(body, secret);
    const tamperedBody = JSON.stringify({ gatewayEventId: "evt_1", amount: 999999 });
    expect(verifySignature(tamperedBody, secret, signature)).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifySignature(body, secret, undefined)).toBe(false);
  });

  it("rejects a malformed (non-hex) signature without throwing", () => {
    expect(verifySignature(body, secret, "not-a-hex-signature")).toBe(false);
  });

  it("rejects a truncated signature", () => {
    const signature = signPayload(body, secret);
    expect(verifySignature(body, secret, signature.slice(0, 10))).toBe(false);
  });
});
