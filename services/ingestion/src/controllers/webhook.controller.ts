import type { FastifyReply, FastifyRequest } from "fastify";
import { ValidationError } from "@payrecon/shared";
import type { WebhookService } from "../services/webhook.service";

export function createWebhookController(webhookService: WebhookService) {
  return {
    async handlePaymentWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      if (!Buffer.isBuffer(request.body)) {
        throw new ValidationError("Expected raw request body");
      }

      const signature = request.headers["x-payrecon-signature"];
      const signatureHeader = Array.isArray(signature) ? signature[0] : signature;

      const result = await webhookService.processWebhook(request.body, signatureHeader);
      reply.status(200).send(result);
    },
  };
}
