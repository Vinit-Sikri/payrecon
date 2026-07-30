import type { FastifyInstance } from "fastify";

export function registerCorrelationId(app: FastifyInstance): void {
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
}
