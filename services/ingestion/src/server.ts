import { loadDotEnv } from "@payrecon/shared";
loadDotEnv();

import { disconnectPrisma } from "@payrecon/db";
import { getEnv } from "./config/env";
import { buildApp } from "./app";

async function main(): Promise<void> {
  const env = getEnv();
  const { app, redis } = buildApp(env);

  try {
    await app.listen({ port: env.INGESTION_PORT, host: env.INGESTION_HOST });
  } catch (err) {
    app.log.error(err, "failed to start ingestion service");
    process.exit(1);
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    await redis.quit();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
