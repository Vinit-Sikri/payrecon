import type { FastifyInstance } from "fastify";
import { createLedgerController } from "../controllers/ledger.controller";
import type { LedgerService } from "../services/ledger.service";

const ledgerEntrySchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    paymentEventId: { type: "string", format: "uuid" },
    orderId: { type: "string", format: "uuid" },
    accountType: { type: "string", enum: ["GATEWAY_RECEIVABLE", "MERCHANT_PAYABLE"] },
    direction: { type: "string", enum: ["DEBIT", "CREDIT"] },
    amount: { type: "integer", description: "Minor units (e.g. cents)" },
    currency: { type: "string" },
    status: { type: "string", enum: ["PENDING_SETTLEMENT", "SETTLED"] },
    createdAt: { type: "string", format: "date-time" },
    settledAt: { type: ["string", "null"], format: "date-time" },
  },
} as const;

export function ledgerRoutes(ledgerService: LedgerService) {
  const controller = createLedgerController(ledgerService);

  return async function routes(app: FastifyInstance): Promise<void> {
    app.get(
      "/",
      {
        schema: {
          tags: ["ledger"],
          summary: "List ledger entries",
          response: {
            200: { type: "object", properties: { entries: { type: "array", items: ledgerEntrySchema } } },
          },
        },
      },
      controller.listEntries,
    );

    app.get(
      "/balance",
      {
        schema: {
          tags: ["ledger"],
          summary: "Trial balance — total debits vs credits per account (should net to zero)",
          response: {
            200: {
              type: "object",
              properties: {
                accounts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      accountType: { type: "string" },
                      totalDebit: { type: "integer" },
                      totalCredit: { type: "integer" },
                      net: { type: "integer" },
                    },
                  },
                },
                overallNet: { type: "integer" },
              },
            },
          },
        },
      },
      controller.getBalance,
    );
  };
}
