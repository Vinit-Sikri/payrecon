import { z } from "zod";
import { loadEnv } from "@payrecon/shared";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  INGESTION_PORT: z.coerce.number().int().positive().default(3000),
  INGESTION_HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  WEBHOOK_HMAC_SECRET: z.string().min(16, "WEBHOOK_HMAC_SECRET should be at least 16 characters"),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return loadEnv(envSchema);
}
