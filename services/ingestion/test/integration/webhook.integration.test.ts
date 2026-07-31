import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { prisma, disconnectPrisma } from "@payrecon/db";
import { signPayload, PAYMENT_EVENTS_STREAM, type RedisClient } from "@payrecon/shared";
import { getEnv } from "../../src/config/env";
import { buildApp } from "../../src/app";

/**
 * Exercises the real webhook ingestion path against a live Postgres + Redis
 * (docker-compose, see repo root) — no mocks. Covers: HMAC verification,
 * Redis-SETNX idempotency dedup, the DB unique-constraint backstop, and
 * publish-to-stream. The reconciliation half of "webhook → reconciliation"
 * is covered separately in reconciliation-worker's integration tests, since
 * that's a genuinely separate deployable with its own DB access.
 */
describe("webhook ingestion (integration)", () => {
  const env = getEnv();
  let app: FastifyInstance;
  let redis: RedisClient;

  beforeAll(async () => {
    ({ app, redis } = buildApp(env));
    await app.ready();
  });

  beforeEach(async () => {
    // ledgerEntry/settlementRecord/settlementBatch have FK references to
    // paymentEvent — must clear them first (settlement.integration.test.ts
    // shares this same live Postgres instance and can leave rows behind).
    await prisma.ledgerEntry.deleteMany();
    await prisma.settlementRecord.deleteMany();
    await prisma.settlementBatch.deleteMany();
    await prisma.mismatch.deleteMany();
    await prisma.paymentEvent.deleteMany();
    await prisma.order.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
    await disconnectPrisma();
  });

  function sign(body: string): string {
    return signPayload(body, env.WEBHOOK_HMAC_SECRET);
  }

  async function createOrder(overrides: Partial<{ amount: number; currency: string }> = {}) {
    return prisma.order.create({
      data: { amount: overrides.amount ?? 5000, currency: overrides.currency ?? "USD" },
    });
  }

  it("accepts a validly signed webhook, persists it, and publishes to the stream", async () => {
    const order = await createOrder();
    const streamLenBefore = await redis.xlen(PAYMENT_EVENTS_STREAM);

    const payload = JSON.stringify({
      gatewayEventId: randomUUID(),
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: "SUCCESS",
      occurredAt: new Date().toISOString(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payments",
      headers: { "content-type": "application/json", "x-payrecon-signature": sign(payload) },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "accepted" });

    const events = await prisma.paymentEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);

    const streamLenAfter = await redis.xlen(PAYMENT_EVENTS_STREAM);
    expect(streamLenAfter).toBe(streamLenBefore + 1);
  });

  it("deduplicates a redelivered webhook with the same gatewayEventId", async () => {
    const order = await createOrder();
    const gatewayEventId = randomUUID();
    const payload = JSON.stringify({
      gatewayEventId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: "SUCCESS",
      occurredAt: new Date().toISOString(),
    });
    const signature = sign(payload);

    const first = await app.inject({
      method: "POST",
      url: "/webhooks/payments",
      headers: { "content-type": "application/json", "x-payrecon-signature": signature },
      payload,
    });
    expect(first.json()).toMatchObject({ status: "accepted" });

    const streamLenBefore = await redis.xlen(PAYMENT_EVENTS_STREAM);

    const second = await app.inject({
      method: "POST",
      url: "/webhooks/payments",
      headers: { "content-type": "application/json", "x-payrecon-signature": signature },
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ status: "duplicate" });

    const events = await prisma.paymentEvent.findMany({ where: { gatewayEventId } });
    expect(events).toHaveLength(1);

    const streamLenAfter = await redis.xlen(PAYMENT_EVENTS_STREAM);
    expect(streamLenAfter).toBe(streamLenBefore);
  });

  it("stores a null orderId (not a DB error) when the referenced order doesn't exist yet", async () => {
    const missingOrderId = randomUUID();
    const payload = JSON.stringify({
      gatewayEventId: randomUUID(),
      orderId: missingOrderId,
      amount: 1000,
      currency: "USD",
      status: "SUCCESS",
      occurredAt: new Date().toISOString(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payments",
      headers: { "content-type": "application/json", "x-payrecon-signature": sign(payload) },
      payload,
    });

    expect(response.statusCode).toBe(200);
    const event = await prisma.paymentEvent.findFirst({ where: { orderId: null } });
    expect(event).not.toBeNull();
    expect((event?.rawPayload as { orderId?: string })?.orderId).toBe(missingOrderId);
  });

  it("rejects a webhook with an invalid signature", async () => {
    const payload = JSON.stringify({
      gatewayEventId: randomUUID(),
      orderId: randomUUID(),
      amount: 1000,
      currency: "USD",
      status: "SUCCESS",
      occurredAt: new Date().toISOString(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payments",
      headers: { "content-type": "application/json", "x-payrecon-signature": "0".repeat(64) },
      payload,
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects a webhook payload that fails schema validation", async () => {
    const payload = JSON.stringify({ gatewayEventId: "not-a-uuid" });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payments",
      headers: { "content-type": "application/json", "x-payrecon-signature": sign(payload) },
      payload,
    });

    expect(response.statusCode).toBe(400);
  });
});
