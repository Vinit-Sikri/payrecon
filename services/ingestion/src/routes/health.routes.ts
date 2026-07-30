import type { FastifyInstance } from "fastify";
import { prisma } from "@payrecon/db";
import type { RedisClient } from "@payrecon/shared";

export function healthRoutes(redis: RedisClient) {
  return async function routes(app: FastifyInstance): Promise<void> {
    // Liveness: process is up and answering HTTP. No dependency checks —
    // a flaky DB/Redis shouldn't make an orchestrator kill a healthy process.
    app.get(
      "/health",
      { schema: { tags: ["health"], summary: "Liveness probe" } },
      async () => ({
        status: "ok",
        service: "ingestion",
        timestamp: new Date().toISOString(),
      }),
    );

    // Readiness: safe to receive traffic. Checks the dependencies the
    // webhook path actually needs on every request.
    app.get("/health/ready", { schema: { tags: ["health"], summary: "Readiness probe (DB + Redis)" } }, async (_request, reply) => {
      const [dbOk, redisOk] = await Promise.all([
        prisma.$queryRaw`SELECT 1`.then(
          () => true,
          () => false,
        ),
        redis.ping().then(
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
  };
}
