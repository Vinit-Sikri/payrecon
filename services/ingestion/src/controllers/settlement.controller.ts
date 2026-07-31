import type { FastifyReply, FastifyRequest } from "fastify";
import { ValidationError } from "@payrecon/shared";
import {
  listSettlementBatchesQuerySchema,
  settlementBatchIdParamSchema,
} from "../schemas/settlement.schema";
import type { SettlementService } from "../services/settlement.service";

export function createSettlementController(settlementService: SettlementService) {
  return {
    async uploadBatch(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const file = await request.file();
      if (!file) {
        throw new ValidationError("Expected a multipart file field named 'file'", {});
      }

      const fileBuffer = await file.toBuffer();
      const batch = await settlementService.processUpload(fileBuffer, file.filename);
      reply.status(201).send(batch);
    },

    async listBatches(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const parsed = listSettlementBatchesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new ValidationError("Invalid query parameters", parsed.error.flatten());
      }

      const batches = await settlementService.list(parsed.data.limit);
      reply.status(200).send({ batches });
    },

    async getBatch(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const parsedParams = settlementBatchIdParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        throw new ValidationError("Invalid settlement batch id", parsedParams.error.flatten());
      }

      const batch = await settlementService.getById(parsedParams.data.id);
      reply.status(200).send(batch);
    },
  };
}
