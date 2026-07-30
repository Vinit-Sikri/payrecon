import { loadDotEnv } from "@payrecon/shared";
loadDotEnv();

import { getEnv } from "./config/env";
import { buildApp } from "./app";

async function main(): Promise<void> {
  const env = getEnv();
  const { app, simulationService } = buildApp(env);

  try {
    await app.listen({ port: env.MOCK_GATEWAY_PORT, host: env.MOCK_GATEWAY_HOST });
  } catch (err) {
    app.log.error(err, "failed to start mock gateway");
    process.exit(1);
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "shutting down");
    simulationService.shutdown();
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
