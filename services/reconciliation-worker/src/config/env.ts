import { z } from "zod";
import { loadEnv } from "@payrecon/shared";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(4100),
  WORKER_HEALTH_HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  // Business-rule tuning.
  RECONCILIATION_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  RECONCILIATION_DELAY_THRESHOLD_MS: z.coerce.number().int().positive().default(3_600_000), // 1 hour

  // Redis Streams / locking tuning.
  RECONCILIATION_LOCK_TTL_MS: z.coerce.number().int().positive().default(30_000),
  STREAM_BLOCK_MS: z.coerce.number().int().positive().default(5_000),
  STREAM_BATCH_SIZE: z.coerce.number().int().positive().default(10),
  RETRY_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return loadEnv(envSchema);
}
