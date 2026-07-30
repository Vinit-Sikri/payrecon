import type { RedisClient } from "@payrecon/shared";

const KEY_PREFIX = "payrecon:idem:webhook:";

/**
 * Fast-path duplicate detection via Redis SETNX + TTL. This is intentionally
 * separate from the DB unique constraint on gatewayEventId (see
 * PaymentEventRepository.upsertPending): Redis answers in ~1ms without a
 * round trip to Postgres, which matters because the webhook handler must
 * ack fast. The DB constraint exists only as a backstop for the rare case
 * where a Redis key expires (TTL) before a genuine duplicate is redelivered.
 */
export class IdempotencyService {
  constructor(
    private readonly redis: RedisClient,
    private readonly ttlSeconds: number,
  ) {}

  /** Returns true the first time `key` is seen; false on every subsequent call within the TTL window. */
  async markIfNew(key: string): Promise<boolean> {
    const result = await this.redis.set(`${KEY_PREFIX}${key}`, "1", "EX", this.ttlSeconds, "NX");
    return result === "OK";
  }
}
