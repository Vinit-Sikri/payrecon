import type { FastifyReply, FastifyRequest } from "fastify";
import { ValidationError } from "@payrecon/shared";
import { recentMismatchesQuerySchema } from "../schemas/stats.schema";
import type { StatsService } from "../services/stats.service";

export function createStatsController(statsService: StatsService) {
  return {
    async getSummary(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const summary = await statsService.getSummary();
      reply.status(200).send(summary);
    },

    async getRecentMismatches(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const parsed = recentMismatchesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new ValidationError("Invalid query parameters", parsed.error.flatten());
      }

      const mismatches = await statsService.getRecentMismatches(parsed.data.limit);
      reply.status(200).send({ mismatches });
    },
  };
}
