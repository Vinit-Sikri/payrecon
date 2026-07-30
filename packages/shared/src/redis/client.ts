import Redis from "ioredis";

/**
 * Every service (ingestion, worker) builds its Redis connection through this
 * factory so retry/ready-check behavior is consistent. Works against both
 * local docker-compose Redis and Upstash's TLS (`rediss://`) endpoint — the
 * scheme in REDIS_URL decides which one ioredis speaks.
 */
export function createRedisClient(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    // Upstash (and most managed Redis) close idle connections; ioredis
    // reconnects automatically, this just bounds the backoff.
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
  });
}

export type { Redis as RedisClient };
