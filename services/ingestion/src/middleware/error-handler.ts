import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isAppError } from "@payrecon/shared";

/**
 * Single place where thrown errors become HTTP responses. AppError subclasses
 * carry their own status code and a client-safe message; anything else is an
 * unexpected bug and is logged with full detail but returned to the client as
 * an opaque 500 so internals/stack traces never leak.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (isAppError(error)) {
      request.log.warn({ err: error }, error.message);
      reply.status(error.statusCode).send(error.toJSON());
      return;
    }

    request.log.error({ err: error }, "unhandled error");
    reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });
}
