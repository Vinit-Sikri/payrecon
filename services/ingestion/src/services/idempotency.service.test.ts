import { describe, expect, it, vi } from "vitest";
import type { RedisClient } from "@payrecon/shared";
import { IdempotencyService } from "./idempotency.service";

function createRedisStub(setResult: "OK" | null) {
  return {
    set: vi.fn().mockResolvedValue(setResult),
  } as unknown as RedisClient;
}

describe("IdempotencyService", () => {
  it("returns true and uses SET NX EX the first time a key is seen", async () => {
    const redis = createRedisStub("OK");
    const service = new IdempotencyService(redis, 86400);

    const isNew = await service.markIfNew("evt_1");

    expect(isNew).toBe(true);
    expect(redis.set).toHaveBeenCalledWith("payrecon:idem:webhook:evt_1", "1", "EX", 86400, "NX");
  });

  it("returns false when the key already exists (duplicate delivery)", async () => {
    const redis = createRedisStub(null);
    const service = new IdempotencyService(redis, 86400);

    const isNew = await service.markIfNew("evt_1");

    expect(isNew).toBe(false);
  });
});
