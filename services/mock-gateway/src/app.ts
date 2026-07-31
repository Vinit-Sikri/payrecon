import { randomUUID } from "node:crypto";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { createLogger } from "@payrecon/shared";
import type { Env } from "./config/env";
import { registerErrorHandler } from "./middleware/error-handler";
import { registerCorrelationId } from "./middleware/correlation-id";
import { healthRoutes } from "./routes/health.routes";
import { paymentRoutes } from "./routes/payment.routes";
import { SimulationService } from "./services/simulation.service";

export interface BuiltApp {
  app: FastifyInstance;
  simulationService: SimulationService;
}

export function buildApp(env: Env): BuiltApp {
  // Widened to FastifyBaseLogger — see services/ingestion/src/app.ts for why
  // passing the concrete pino.Logger type breaks Fastify's generics.
  const logger: FastifyBaseLogger = createLogger({
    serviceName: "mock-gateway",
    level: env.LOG_LEVEL,
    pretty: env.NODE_ENV !== "production",
  });

  const app = Fastify({
    loggerInstance: logger,
    genReqId: (request) => (request.headers["x-request-id"] as string | undefined) ?? randomUUID(),
  });

  const simulationService = new SimulationService(env, logger);

  registerCorrelationId(app);
  registerErrorHandler(app);
  void app.register(cors, { origin: env.DASHBOARD_ORIGIN });

  app.register(healthRoutes);
  app.register(paymentRoutes(simulationService), { prefix: "/payments" });

  return { app, simulationService };
}
