import type { FastifyInstance } from "fastify";
import { createStatsController } from "../controllers/stats.controller";
import type { StatsService } from "../services/stats.service";

export function statsRoutes(statsService: StatsService) {
  const controller = createStatsController(statsService);

  return async function routes(app: FastifyInstance): Promise<void> {
    app.get(
      "/",
      {
        schema: {
          tags: ["stats"],
          summary: "Reconciliation state counts",
          response: {
            200: {
              type: "object",
              properties: {
                counts: {
                  type: "object",
                  properties: {
                    PENDING: { type: "integer" },
                    MATCHED: { type: "integer" },
                    MISMATCHED: { type: "integer" },
                    FAILED: { type: "integer" },
                    DEAD_LETTERED: { type: "integer" },
                  },
                },
                total: { type: "integer" },
              },
            },
          },
        },
      },
      controller.getSummary,
    );

    app.get(
      "/mismatches",
      {
        schema: {
          tags: ["stats"],
          summary: "Recent reconciliation mismatches",
          response: {
            200: {
              type: "object",
              properties: {
                mismatches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      reason: { type: "string" },
                      detail: {},
                      createdAt: { type: "string", format: "date-time" },
                      paymentEvent: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          gatewayEventId: { type: "string" },
                          orderId: { type: ["string", "null"] },
                          amount: { type: "integer" },
                          currency: { type: "string" },
                          gatewayStatus: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      controller.getRecentMismatches,
    );
  };
}
