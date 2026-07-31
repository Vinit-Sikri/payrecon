import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { prisma, disconnectPrisma } from "@payrecon/db";
import type { RedisClient } from "@payrecon/shared";
import { getEnv } from "../../src/config/env";
import { buildApp } from "../../src/app";

/**
 * Exercises the real settlement upload path against a live Postgres (see
 * webhook.integration.test.ts for the equivalent rationale) — no mocks.
 * Covers: CSV parsing, per-row matching against real PaymentEvents,
 * fileHash-based upload idempotency, and the ledger settlement flip.
 */
describe("settlement upload (integration)", () => {
  const env = getEnv();
  let app: FastifyInstance;
  let redis: RedisClient;

  beforeAll(async () => {
    ({ app, redis } = buildApp(env));
    await app.ready();
  });

  beforeEach(async () => {
    await prisma.settlementRecord.deleteMany();
    await prisma.settlementBatch.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.mismatch.deleteMany();
    await prisma.paymentEvent.deleteMany();
    await prisma.order.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
    await disconnectPrisma();
  });

  /** Hand-builds a multipart/form-data body — no client library needed for one file field. */
  function buildMultipartUpload(filename: string, csvContent: string) {
    const boundary = `----payrecon-test-${randomUUID()}`;
    const payload =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: text/csv\r\n\r\n` +
      `${csvContent}\r\n` +
      `--${boundary}--\r\n`;

    return { payload, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
  }

  async function createMatchedPaymentEvent(overrides: Partial<{ amount: number; currency: string }> = {}) {
    const amount = overrides.amount ?? 5000;
    const currency = overrides.currency ?? "USD";
    const order = await prisma.order.create({ data: { amount, currency, status: "PAID" } });
    const event = await prisma.paymentEvent.create({
      data: {
        gatewayEventId: `evt-${randomUUID()}`,
        idempotencyKey: `evt-${randomUUID()}`,
        orderId: order.id,
        amount,
        currency,
        gatewayStatus: "SUCCESS",
        reconciliationState: "MATCHED",
        rawPayload: { orderId: order.id },
        receivedAt: new Date(),
        processedAt: new Date(),
      },
    });
    await prisma.ledgerEntry.createMany({
      data: [
        { paymentEventId: event.id, orderId: order.id, accountType: "GATEWAY_RECEIVABLE", direction: "DEBIT", amount, currency },
        { paymentEventId: event.id, orderId: order.id, accountType: "MERCHANT_PAYABLE", direction: "CREDIT", amount, currency },
      ],
    });
    return event;
  }

  it("matches a settlement record against its payment event and flips the ledger to SETTLED", async () => {
    const event = await createMatchedPaymentEvent({ amount: 5000, currency: "USD" });
    const csv = `gatewayEventId,amount,currency,settledAt\n${event.gatewayEventId},5000,USD,${new Date().toISOString()}`;
    const { payload, headers } = buildMultipartUpload("settlement.csv", csv);

    const response = await app.inject({ method: "POST", url: "/settlements", headers, payload });

    expect(response.statusCode).toBe(201);
    const batch = response.json();
    expect(batch.status).toBe("COMPLETED");
    expect(batch.totalRecords).toBe(1);
    expect(batch.matchedCount).toBe(1);

    const ledgerEntries = await prisma.ledgerEntry.findMany({ where: { paymentEventId: event.id } });
    expect(ledgerEntries.every((e) => e.status === "SETTLED")).toBe(true);
    expect(ledgerEntries.every((e) => e.settledAt !== null)).toBe(true);
  });

  it("flags an amount mismatch between the settlement record and the payment event", async () => {
    const event = await createMatchedPaymentEvent({ amount: 5000, currency: "USD" });
    const csv = `gatewayEventId,amount,currency,settledAt\n${event.gatewayEventId},4900,USD,${new Date().toISOString()}`;
    const { payload, headers } = buildMultipartUpload("settlement.csv", csv);

    const response = await app.inject({ method: "POST", url: "/settlements", headers, payload });

    expect(response.statusCode).toBe(201);
    const batch = response.json();
    expect(batch.mismatchedCount).toBe(1);

    const ledgerEntries = await prisma.ledgerEntry.findMany({ where: { paymentEventId: event.id } });
    expect(ledgerEntries.every((e) => e.status === "PENDING_SETTLEMENT")).toBe(true);
  });

  it("flags a settlement record with no matching payment event as UNMATCHED", async () => {
    const csv = `gatewayEventId,amount,currency,settledAt\nunmatched-${randomUUID()},999,USD,${new Date().toISOString()}`;
    const { payload, headers } = buildMultipartUpload("settlement.csv", csv);

    const response = await app.inject({ method: "POST", url: "/settlements", headers, payload });

    expect(response.statusCode).toBe(201);
    expect(response.json().unmatchedCount).toBe(1);
  });

  it("returns the existing batch instead of reprocessing when the same file content is re-uploaded", async () => {
    const event = await createMatchedPaymentEvent({ amount: 5000, currency: "USD" });
    const csv = `gatewayEventId,amount,currency,settledAt\n${event.gatewayEventId},5000,USD,${new Date().toISOString()}`;

    const first = buildMultipartUpload("settlement.csv", csv);
    const firstResponse = await app.inject({ method: "POST", url: "/settlements", headers: first.headers, payload: first.payload });
    const firstBatch = firstResponse.json();

    const second = buildMultipartUpload("settlement.csv", csv);
    const secondResponse = await app.inject({ method: "POST", url: "/settlements", headers: second.headers, payload: second.payload });
    const secondBatch = secondResponse.json();

    expect(secondBatch.id).toBe(firstBatch.id);

    const batchCount = await prisma.settlementBatch.count();
    expect(batchCount).toBe(1);
  });
});
