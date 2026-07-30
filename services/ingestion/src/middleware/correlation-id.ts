import type { FastifyInstance } from "fastify";

/**
 * Echoes the request id (either the inbound x-request-id header or the
 * generated UUID, see genReqId in app.ts) back on the response so callers
 * can correlate a request across the ingestion service and the worker logs.
 *
 */
export function registerCorrelationId(app: FastifyInstance): void {
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
}
