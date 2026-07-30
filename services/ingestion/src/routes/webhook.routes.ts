import type { FastifyInstance } from "fastify";
import { rawBodyPlugin } from "../middleware/raw-body";
import { createWebhookController } from "../controllers/webhook.controller";
import type { WebhookService } from "../services/webhook.service";

export function webhookRoutes(webhookService: WebhookService) {
  const controller = createWebhookController(webhookService);

  return async function routes(app: FastifyInstance): Promise<void> {
    // Applying the raw-body parser inside this nested plugin scopes it to
    // just this route's encapsulation context — sibling routes (orders,
    // stats) keep Fastify's normal JSON body parsing. Must call
    // rawBodyPlugin(scoped) directly rather than scoped.register(rawBodyPlugin)
    // — .register() creates its own child encapsulation context, so the
    // parser would end up scoped to that child, not to `scoped` itself,
    // and the sibling route below would never see it.
    await app.register(async (scoped) => {
      await rawBodyPlugin(scoped);
      scoped.post(
        "/payments",
        {
          schema: {
            tags: ["webhooks"],
            summary: "Payment gateway webhook intake",
            description:
              "Requires an x-payrecon-signature header (HMAC-SHA256 of the raw body). " +
              "No request body schema is declared here deliberately — this route consumes " +
              "the raw byte body for signature verification, not a pre-parsed JSON object.",
            response: {
              200: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["accepted", "duplicate"] },
                  paymentEventId: { type: "string" },
                },
              },
            },
          },
        },
        controller.handlePaymentWebhook,
      );
    });
  };
}
