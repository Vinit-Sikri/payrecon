import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { createSettlementController } from "../controllers/settlement.controller";
import type { SettlementService } from "../services/settlement.service";

const settlementRecordSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    gatewayEventId: { type: "string" },
    amount: { type: "integer" },
    currency: { type: "string" },
    settledAt: { type: "string", format: "date-time" },
    matchStatus: { type: "string", enum: ["MATCHED", "AMOUNT_MISMATCH", "UNMATCHED"] },
    paymentEventId: { type: ["string", "null"] },
  },
} as const;

const settlementBatchSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    filename: { type: "string" },
    uploadedAt: { type: "string", format: "date-time" },
    status: { type: "string", enum: ["PROCESSING", "COMPLETED", "FAILED"] },
    totalRecords: { type: "integer" },
    matchedCount: { type: "integer" },
    mismatchedCount: { type: "integer" },
    unmatchedCount: { type: "integer" },
  },
} as const;

export function settlementRoutes(settlementService: SettlementService) {
  const controller = createSettlementController(settlementService);

  return async function routes(app: FastifyInstance): Promise<void> {
    // @fastify/multipart is registered inside this nested plugin so its body
    // parsing only applies to this route's encapsulation context — same
    // scoping concern as the raw-body parser in webhook.routes.ts, so
    // sibling routes (orders, stats, ledger) keep normal JSON parsing.
    await app.register(async (scoped) => {
      await scoped.register(multipart);
      scoped.post(
        "/",
        {
          schema: {
            tags: ["settlements"],
            summary: "Upload a bank settlement file (CSV) for batch reconciliation",
            description:
              "multipart/form-data upload, file field named 'file'. Re-uploading the same " +
              "file content (by hash) returns the existing batch instead of reprocessing it.",
            response: { 201: settlementBatchSchema },
          },
        },
        controller.uploadBatch,
      );
    });

    app.get(
      "/",
      {
        schema: {
          tags: ["settlements"],
          summary: "List settlement batches",
          response: {
            200: { type: "object", properties: { batches: { type: "array", items: settlementBatchSchema } } },
          },
        },
      },
      controller.listBatches,
    );

    app.get(
      "/:id",
      {
        schema: {
          tags: ["settlements"],
          summary: "Get a settlement batch and its per-record breakdown",
          response: {
            200: {
              type: "object",
              properties: {
                ...settlementBatchSchema.properties,
                records: { type: "array", items: settlementRecordSchema },
              },
            },
          },
        },
      },
      controller.getBatch,
    );
  };
}
