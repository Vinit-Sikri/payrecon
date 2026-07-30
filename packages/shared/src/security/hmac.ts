import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signs a raw webhook body with HMAC-SHA256. Both the mock gateway (signer)
 * and the ingestion service (verifier) call this so they can never drift on
 * the algorithm/encoding.
 */
export function signPayload(rawBody: string | Buffer, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/**
 * Verifies a webhook signature against the exact raw bytes that were signed.
 * Callers MUST pass the untouched request body (not a re-serialized JSON
 * object) — re-serializing can reorder keys/whitespace and break the HMAC.
 * Uses a timing-safe comparison to avoid leaking signature bytes via
 * response-time side channels.
 */
export function verifySignature(rawBody: string | Buffer, secret: string, signature: string | undefined): boolean {
  if (!signature) {
    return false;
  }

  const expected = signPayload(rawBody, secret);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, actualBuf);
}
