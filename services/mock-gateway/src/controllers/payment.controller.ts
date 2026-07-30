import type { FastifyReply, FastifyRequest } from "fastify";
import { ValidationError } from "@payrecon/shared";
import { simulatePaymentSchema } from "../schemas/payment.schema";
import type { SimulationService } from "../services/simulation.service";

export function createPaymentController(simulationService: SimulationService) {
  return {
    async simulatePayment(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const parsed = simulatePaymentSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError("Invalid payment simulation request", parsed.error.flatten());
      }

      const result = simulationService.simulatePayment(parsed.data);
      reply.status(202).send(result);
    },
  };
}
