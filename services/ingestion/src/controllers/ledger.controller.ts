import type { FastifyReply, FastifyRequest } from "fastify";
import { ValidationError } from "@payrecon/shared";
import { listLedgerEntriesQuerySchema } from "../schemas/ledger.schema";
import type { LedgerService } from "../services/ledger.service";

export function createLedgerController(ledgerService: LedgerService) {
  return {
    async listEntries(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const parsed = listLedgerEntriesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new ValidationError("Invalid query parameters", parsed.error.flatten());
      }

      const entries = await ledgerService.listEntries(parsed.data);
      reply.status(200).send({ entries });
    },

    async getBalance(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const balance = await ledgerService.getBalance();
      reply.status(200).send(balance);
    },
  };
}
