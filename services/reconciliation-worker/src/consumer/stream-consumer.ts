import os from "node:os";
import type { FastifyBaseLogger } from "fastify";
import {
  PAYMENT_EVENTS_STREAM,
  RECONCILIATION_CONSUMER_GROUP,
  type PaymentEventStreamMessage,
  type RedisClient,
} from "@payrecon/shared";
import { DistributedLock } from "../lib/redis-lock";
import { RetrySchedule } from "../lib/retry-schedule";
import { computeBackoffMs } from "../lib/backoff";
import type { ReconciliationRunner } from "../services/reconciliation-runner.service";
import type { PaymentEventRepository } from "../repositories/payment-event.repository";
import type { DeadLetterRepository } from "../repositories/dead-letter.repository";

export interface StreamConsumerOptions {
  maxAttempts: number;
  lockTtlMs: number;
  blockMs: number;
  batchSize: number;
  retryPollIntervalMs: number;
}

// ioredis's xreadgroup typings return a loosely-typed tuple array; this
// shape matches Redis's documented XREADGROUP reply format.
type XReadGroupReply = [string, [string, string[]][]][] | null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class StreamConsumer {
  private readonly consumerName = `worker-${os.hostname()}-${process.pid}`;
  private readonly lock: DistributedLock;
  private readonly retrySchedule: RetrySchedule;
  private running = false;
  private retryTimer?: NodeJS.Timeout;
  private loopPromise?: Promise<void>;

  constructor(
    private readonly redis: RedisClient,
    private readonly runner: ReconciliationRunner,
    private readonly paymentEventRepository: PaymentEventRepository,
    private readonly deadLetterRepository: DeadLetterRepository,
    private readonly logger: FastifyBaseLogger,
    private readonly options: StreamConsumerOptions,
  ) {
    this.lock = new DistributedLock(redis);
    this.retrySchedule = new RetrySchedule(redis);
  }

  async start(): Promise<void> {
    await this.ensureConsumerGroup();
    this.running = true;
    this.retryTimer = setInterval(() => void this.promoteDueRetries(), this.options.retryPollIntervalMs);
    this.loopPromise = this.loop();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
    }
    await this.loopPromise;
  }

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup("CREATE", PAYMENT_EVENTS_STREAM, RECONCILIATION_CONSUMER_GROUP, "0", "MKSTREAM");
    } catch (err) {
      // BUSYGROUP means the group already exists — expected on every restart.
      if (!(err instanceof Error) || !err.message.includes("BUSYGROUP")) {
        throw err;
      }
    }
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const response = (await this.redis.xreadgroup(
          "GROUP",
          RECONCILIATION_CONSUMER_GROUP,
          this.consumerName,
          "COUNT",
          this.options.batchSize,
          "BLOCK",
          this.options.blockMs,
          "STREAMS",
          PAYMENT_EVENTS_STREAM,
          ">",
        )) as XReadGroupReply;

        if (!response || response.length === 0) {
          continue;
        }

        const streamEntry = response[0];
        if (!streamEntry) {
          continue;
        }

        const [, entries] = streamEntry;
        for (const [id, fields] of entries) {
          await this.handleMessage(id, fields);
        }
      } catch (err) {
        this.logger.error({ err }, "stream consumer loop error, retrying after delay");
        await sleep(1000);
      }
    }
  }

  private async handleMessage(streamId: string, fields: string[]): Promise<void> {
    const raw = fields[1]; // XADD wrote a single ["data", "<json>"] field pair.
    if (!raw) {
      await this.ack(streamId);
      return;
    }

    const message = JSON.parse(raw) as PaymentEventStreamMessage;
    const lockKey = `payrecon:lock:payment-event:${message.paymentEventId}`;
    const token = await this.lock.acquire(lockKey, this.options.lockTtlMs);

    if (!token) {
      this.logger.warn(
        { paymentEventId: message.paymentEventId },
        "could not acquire lock, another worker owns this event; skipping delivery",
      );
      await this.ack(streamId);
      return;
    }

    try {
      await this.runner.run(message.paymentEventId);
      await this.ack(streamId);
    } catch (err) {
      await this.handleFailure(message.paymentEventId, streamId, err);
    } finally {
      await this.lock.release(lockKey, token);
    }
  }

  private async handleFailure(paymentEventId: string, streamId: string, err: unknown): Promise<void> {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const paymentEvent = await this.paymentEventRepository.incrementAttempts(paymentEventId, errorMessage);

    // Ack unconditionally: redelivery is driven by the retry-schedule sorted
    // set, not the stream's pending-entries list, so leaving this un-acked
    // would only leak entries into the PEL forever.
    await this.ack(streamId);

    if (paymentEvent.attempts >= this.options.maxAttempts) {
      this.logger.error(
        { paymentEventId, attempts: paymentEvent.attempts, err: errorMessage },
        "max attempts exceeded, dead-lettering",
      );
      await this.deadLetterRepository.create({
        paymentEventId,
        payload: paymentEvent.rawPayload,
        reason: errorMessage,
        attempts: paymentEvent.attempts,
      });
      await this.paymentEventRepository.markDeadLettered(paymentEventId);
      return;
    }

    await this.paymentEventRepository.markFailed(paymentEventId);
    const readyAt = Date.now() + computeBackoffMs(paymentEvent.attempts);
    await this.retrySchedule.scheduleRetry(paymentEventId, readyAt);
    this.logger.warn(
      { paymentEventId, attempts: paymentEvent.attempts, retryAt: new Date(readyAt).toISOString() },
      "processing failed, scheduled retry",
    );
  }

  private async promoteDueRetries(): Promise<void> {
    const due = await this.retrySchedule.pullDue(Date.now(), this.options.batchSize);
    for (const paymentEventId of due) {
      const message: PaymentEventStreamMessage = { paymentEventId };
      await this.redis.xadd(PAYMENT_EVENTS_STREAM, "*", "data", JSON.stringify(message));
    }
  }

  private async ack(streamId: string): Promise<void> {
    await this.redis.xack(PAYMENT_EVENTS_STREAM, RECONCILIATION_CONSUMER_GROUP, streamId);
  }
}
