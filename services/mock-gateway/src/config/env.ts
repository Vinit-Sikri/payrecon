import { z } from "zod";
import { loadEnv } from "@payrecon/shared";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MOCK_GATEWAY_PORT: z.coerce.number().int().positive().default(4000),
  MOCK_GATEWAY_HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  INGESTION_WEBHOOK_URL: z.string().url(),
  WEBHOOK_HMAC_SECRET: z.string().min(16, "WEBHOOK_HMAC_SECRET should be at least 16 characters"),

  // Simulation knobs — tunable via env so demos/tests can dial the chaos up or down.
  MIN_DELAY_MS: z.coerce.number().int().nonnegative().default(500),
  MAX_DELAY_MS: z.coerce.number().int().nonnegative().default(4000),
  FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.15),
  PENDING_RATE: z.coerce.number().min(0).max(1).default(0.1),
  DUPLICATE_RATE: z.coerce.number().min(0).max(1).default(0.15),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  DASHBOARD_ORIGIN: z.string().default("http://localhost:5173"),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return loadEnv(envSchema);
}
