import { loadDotEnv } from "@payrecon/shared";
loadDotEnv();

import { disconnectPrisma } from "@payrecon/db";
import { createLogger, createRedisClient, type RedisClient } from "@payrecon/shared";
import type { FastifyBaseLogger } from "fastify";
import { getEnv } from "./config/env";
import { buildHealthServer } from "./health-server";
import { StreamConsumer } from "./consumer/stream-consumer";
import { ReconciliationRunner } from "./services/reconciliation-runner.service";
import { OrderRepository } from "./repositories/order.repository";
import { PaymentEventRepository } from "./repositories/payment-event.repository";
import { MismatchRepository } from "./repositories/mismatch.repository";
import { DeadLetterRepository } from "./repositories/dead-letter.repository";
import { LedgerRepository } from "./repositories/ledger.repository";

async function main(): Promise<void> {
  const env = getEnv();

  const logger: FastifyBaseLogger = createLogger({
    serviceName: "reconciliation-worker",
    level: env.LOG_LEVEL,
    pretty: env.NODE_ENV !== "production",
  });

  const redis: RedisClient = createRedisClient(env.REDIS_URL);

  const orderRepository = new OrderRepository();
  const paymentEventRepository = new PaymentEventRepository();
  const mismatchRepository = new MismatchRepository();
  const deadLetterRepository = new DeadLetterRepository();
  const ledgerRepository = new LedgerRepository();

  const runner = new ReconciliationRunner(
    orderRepository,
    paymentEventRepository,
    mismatchRepository,
    ledgerRepository,
    logger,
    { delayThresholdMs: env.RECONCILIATION_DELAY_THRESHOLD_MS },
  );

  const consumer = new StreamConsumer(redis, runner, paymentEventRepository, deadLetterRepository, logger, {
    maxAttempts: env.RECONCILIATION_MAX_ATTEMPTS,
    lockTtlMs: env.RECONCILIATION_LOCK_TTL_MS,
    blockMs: env.STREAM_BLOCK_MS,
    batchSize: env.STREAM_BATCH_SIZE,
    retryPollIntervalMs: env.RETRY_POLL_INTERVAL_MS,
  });

  const healthServer = buildHealthServer({ redis, logger });
  await healthServer.listen({ port: env.WORKER_HEALTH_PORT, host: env.WORKER_HEALTH_HOST });

  await consumer.start();
  logger.info("reconciliation worker started");

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutting down");
    await consumer.stop();
    await healthServer.close();
    await redis.quit();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
