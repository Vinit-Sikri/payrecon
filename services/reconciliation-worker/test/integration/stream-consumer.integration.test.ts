import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma, disconnectPrisma } from "@payrecon/db";
import { createRedisClient, StreamProducer, PaymentStatus, ReconciliationState, type RedisClient } from "@payrecon/shared";
import { getEnv } from "../../src/config/env";
import { StreamConsumer } from "../../src/consumer/stream-consumer";
import { ReconciliationRunner } from "../../src/services/reconciliation-runner.service";
import { OrderRepository } from "../../src/repositories/order.repository";
import { PaymentEventRepository } from "../../src/repositories/payment-event.repository";
import { MismatchRepository } from "../../src/repositories/mismatch.repository";
import { DeadLetterRepository } from "../../src/repositories/dead-letter.repository";
import { LedgerRepository } from "../../src/repositories/ledger.repository";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noopLogger = { info: () => {}, warn: () => {}, error: () => {} } as any;

async function waitFor(check: () => Promise<boolean>, timeoutMs: number, intervalMs = 100): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for condition`);
}

/**
 * Drives the real pipeline: publish onto Redis Streams the same way
 * ingestion's WebhookService does, then let a real StreamConsumer (with
 * real locking) pick it up and reconcile against Postgres. This is the
 * closest thing to a full "webhook → reconciliation" test that doesn't
 * require two live HTTP processes — see webhook.integration.test.ts in
 * ingestion for the producer half of the same contract.
 */
describe("StreamConsumer (integration)", () => {
  const env = getEnv();
  let redis: RedisClient;
  let producer: StreamProducer;
  let consumer: StreamConsumer;
  let paymentEventRepository: PaymentEventRepository;
  let orderRepository: OrderRepository;

  beforeEach(async () => {
    await prisma.ledgerEntry.deleteMany();
    await prisma.settlementRecord.deleteMany();
    await prisma.settlementBatch.deleteMany();
    await prisma.mismatch.deleteMany();
    await prisma.paymentEvent.deleteMany();
    await prisma.order.deleteMany();

    redis = createRedisClient(env.REDIS_URL);
    producer = new StreamProducer(redis);

    orderRepository = new OrderRepository();
    paymentEventRepository = new PaymentEventRepository();
    const mismatchRepository = new MismatchRepository();
    const deadLetterRepository = new DeadLetterRepository();
    const ledgerRepository = new LedgerRepository();

    const runner = new ReconciliationRunner(
      orderRepository,
      paymentEventRepository,
      mismatchRepository,
      ledgerRepository,
      noopLogger,
      { delayThresholdMs: env.RECONCILIATION_DELAY_THRESHOLD_MS },
    );

    consumer = new StreamConsumer(redis, runner, paymentEventRepository, deadLetterRepository, noopLogger, {
      maxAttempts: env.RECONCILIATION_MAX_ATTEMPTS,
      lockTtlMs: env.RECONCILIATION_LOCK_TTL_MS,
      blockMs: 500, // short so the loop notices stop() quickly in tests
      batchSize: env.STREAM_BATCH_SIZE,
      retryPollIntervalMs: env.RETRY_POLL_INTERVAL_MS,
    });
    await consumer.start();
  });

  afterEach(async () => {
    await consumer.stop();
    await redis.quit();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("consumes a published message end-to-end and reconciles a matched payment", async () => {
    const order = await prisma.order.create({ data: { amount: 7500, currency: "USD" } });
    const event = await prisma.paymentEvent.create({
      data: {
        gatewayEventId: `evt-e2e-${order.id}`,
        idempotencyKey: `evt-e2e-${order.id}`,
        orderId: order.id,
        amount: 7500,
        currency: "USD",
        gatewayStatus: PaymentStatus.SUCCESS,
        rawPayload: { orderId: order.id },
        receivedAt: new Date(),
      },
    });

    await producer.publish({ paymentEventId: event.id });

    await waitFor(async () => {
      const current = await paymentEventRepository.findById(event.id);
      return current?.reconciliationState !== ReconciliationState.PENDING;
    }, 10_000);

    const finalEvent = await paymentEventRepository.findById(event.id);
    const finalOrder = await orderRepository.findById(order.id);

    expect(finalEvent?.reconciliationState).toBe(ReconciliationState.MATCHED);
    expect(finalOrder?.status).toBe("PAID");
  }, 15_000);
});
