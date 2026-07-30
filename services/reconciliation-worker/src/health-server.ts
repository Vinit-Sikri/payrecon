import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { prisma } from "@payrecon/db";
import type { RedisClient } from "@payrecon/shared";

export interface HealthServerOptions {
  redis: RedisClient;
  logger: FastifyBaseLogger;
}

/**
 * The worker has no other reason to expose HTTP — this exists purely so an
 * orchestrator (Docker healthcheck, k8s probe) has something to poll, per
 * the "health check endpoints for each service" requirement.
 */
export function buildHealthServer(options: HealthServerOptions): FastifyInstance {
  const app = Fastify({ loggerInstance: options.logger });

  app.get("/health", async () => ({
    status: "ok",
    service: "reconciliation-worker",
    timestamp: new Date().toISOString(),
  }));

  app.get("/health/ready", async (_request, reply) => {
    const [dbOk, redisOk] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(
        () => true,
        () => false,
      ),
      options.redis.ping().then(
        () => true,
        () => false,
      ),
    ]);

    const ready = dbOk && redisOk;
    reply.status(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      checks: { database: dbOk, redis: redisOk },
    });
  });

  return app;
}
