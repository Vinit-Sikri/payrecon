import type { RedisClient } from "@payrecon/shared";

const RETRY_SCHEDULE_KEY = "payrecon:retry-schedule";

/**
 * Redis Streams has no native per-message delay, so retries are scheduled
 * via a sorted set (score = ready-at epoch ms) instead of leaving failed
 * messages unacked in the stream's pending-entries list. A poller
 * (see StreamConsumer.promoteDueRetries) periodically moves due entries
 * back onto the main stream. This gives each message its own independent
 * exponential backoff, which a single idle-time threshold on XCLAIM/XAUTOCLAIM
 * could not.
 */
export class RetrySchedule {
  constructor(private readonly redis: RedisClient) {}

  async scheduleRetry(paymentEventId: string, readyAtEpochMs: number): Promise<void> {
    await this.redis.zadd(RETRY_SCHEDULE_KEY, readyAtEpochMs, paymentEventId);
  }

  async pullDue(nowEpochMs: number, limit: number): Promise<string[]> {
    const due = await this.redis.zrangebyscore(RETRY_SCHEDULE_KEY, 0, nowEpochMs, "LIMIT", 0, limit);
    if (due.length > 0) {
      await this.redis.zrem(RETRY_SCHEDULE_KEY, ...due);
    }
    return due;
  }
}
