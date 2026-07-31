import { randomUUID } from "node:crypto";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { createLogger, createRedisClient, StreamProducer, type RedisClient } from "@payrecon/shared";
import type { Env } from "./config/env";
import { registerErrorHandler } from "./middleware/error-handler";
import { registerCorrelationId } from "./middleware/correlation-id";
import { registerSwagger } from "./plugins/swagger";
import { healthRoutes } from "./routes/health.routes";
import { orderRoutes } from "./routes/order.routes";
import { webhookRoutes } from "./routes/webhook.routes";
import { statsRoutes } from "./routes/stats.routes";
import { ledgerRoutes } from "./routes/ledger.routes";
import { settlementRoutes } from "./routes/settlement.routes";
import { OrderRepository } from "./repositories/order.repository";
import { PaymentEventRepository } from "./repositories/payment-event.repository";
import { MismatchRepository } from "./repositories/mismatch.repository";
import { LedgerRepository } from "./repositories/ledger.repository";
import { SettlementRepository } from "./repositories/settlement.repository";
import { OrderService } from "./services/order.service";
import { IdempotencyService } from "./services/idempotency.service";
import { WebhookService } from "./services/webhook.service";
import { StatsService } from "./services/stats.service";
import { LedgerService } from "./services/ledger.service";
import { SettlementService } from "./services/settlement.service";

export interface BuiltApp {
  app: FastifyInstance;
  redis: RedisClient;
}

/**
 * Composition root: every dependency (Redis, repositories, services) is
 * constructed once here and threaded into route factories via closures.
 * Nothing below this function reaches for a module-level singleton or reads
 * process.env directly, which keeps the whole graph swappable in tests
 * (see test/integration, which calls buildApp with a test Env).
 */
export function buildApp(env: Env): BuiltApp {
  // Widened to FastifyBaseLogger — passing the concrete pino.Logger type
  // specializes Fastify's Logger generic and breaks its own internal typing.
  const logger: FastifyBaseLogger = createLogger({
    serviceName: "ingestion",
    level: env.LOG_LEVEL,
    pretty: env.NODE_ENV !== "production",
  });

  const app = Fastify({
    loggerInstance: logger,
    genReqId: (request) => (request.headers["x-request-id"] as string | undefined) ?? randomUUID(),
  });

  const redis = createRedisClient(env.REDIS_URL);
  const streamProducer = new StreamProducer(redis);

  const orderRepository = new OrderRepository();
  const paymentEventRepository = new PaymentEventRepository();
  const mismatchRepository = new MismatchRepository();
  const ledgerRepository = new LedgerRepository();
  const settlementRepository = new SettlementRepository();

  const orderService = new OrderService(orderRepository);
  const idempotencyService = new IdempotencyService(redis, env.IDEMPOTENCY_TTL_SECONDS);
  const webhookService = new WebhookService({
    hmacSecret: env.WEBHOOK_HMAC_SECRET,
    idempotencyService,
    orderRepository,
    paymentEventRepository,
    streamProducer,
  });
  const statsService = new StatsService(paymentEventRepository, mismatchRepository);
  const ledgerService = new LedgerService(ledgerRepository);
  const settlementService = new SettlementService(settlementRepository, paymentEventRepository, ledgerRepository);

  registerCorrelationId(app);
  registerErrorHandler(app);
  void app.register(cors, { origin: env.DASHBOARD_ORIGIN });

  // Called directly (not app.register(registerSwagger)) — .register() would
  // create a child encapsulation context, and @fastify/swagger's onRoute
  // hook would then only see routes registered as descendants of *that*
  // context, not the sibling route registrations below. Same class of bug
  // as the raw-body parser in webhook.routes.ts. Must run before the routes
  // below so its onRoute hook is attached in time to capture their schemas.
  void registerSwagger(app);

  app.register(healthRoutes(redis));
  app.register(orderRoutes(orderService), { prefix: "/orders" });
  app.register(webhookRoutes(webhookService), { prefix: "/webhooks" });
  app.register(statsRoutes(statsService), { prefix: "/stats" });
  app.register(ledgerRoutes(ledgerService), { prefix: "/ledger" });
  app.register(settlementRoutes(settlementService), { prefix: "/settlements" });

  return { app, redis };
}
