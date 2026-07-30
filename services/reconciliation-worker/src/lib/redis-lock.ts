import { randomUUID } from "node:crypto";
import type { RedisClient } from "@payrecon/shared";

// Compare-and-delete so a worker can never release a lock it doesn't own
// anymore (e.g. its TTL expired and a different worker already re-acquired
// it) — the classic single-instance Redlock safety pattern.
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

/**
 * Guards against a payment event being processed by two workers at once.
 * Redis Streams consumer groups already partition messages so this
 * shouldn't happen in the common case, but it's cheap insurance against
 * edge cases like XCLAIM reassigning a message while the original consumer
 * is still mid-flight, or a retry being promoted while the original attempt
 * hasn't finished.
 */
export class DistributedLock {
  constructor(private readonly redis: RedisClient) {}

  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(key, token, "PX", ttlMs, "NX");
    return result === "OK" ? token : null;
  }

  async release(key: string, token: string): Promise<void> {
    await this.redis.eval(RELEASE_SCRIPT, 1, key, token);
  }
}
