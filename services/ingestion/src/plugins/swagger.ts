import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

/**
 * Response schemas are attached per-route purely for documentation/
 * serialization — request validation stays owned by the zod schemas in
 * each controller (see controllers/*.ts) so there's exactly one source of
 * truth for "is this input valid," not two validators that could disagree.
 */
export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "PayRecon Ingestion API",
        description:
          "Order management, payment-gateway webhook intake, and reconciliation dashboard/stats for the PayRecon payment reconciliation engine.",
        version: "0.1.0",
      },
      tags: [
        { name: "orders", description: "Mock e-commerce order records" },
        { name: "webhooks", description: "Payment gateway webhook intake" },
        { name: "stats", description: "Reconciliation dashboard/stats" },
        { name: "health", description: "Liveness/readiness probes" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });
}
