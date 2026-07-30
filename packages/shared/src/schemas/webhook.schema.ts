import { z } from "zod";
import { currencySchema } from "./order.schema";

/**
 * Contract between the mock gateway (producer) and the ingestion service
 * (consumer) for webhook deliveries. `gatewayEventId` doubles as the
 * idempotency key — mirrors how real providers (e.g. Stripe) key webhook
 * dedup off the event's own id rather than a separate header.
 */
export const webhookPayloadSchema = z.object({
  gatewayEventId: z.string().uuid(),
  orderId: z.string().uuid(),
  amount: z.number().int().positive(),
  currency: currencySchema,
  status: z.enum(["SUCCESS", "FAILED", "PENDING", "REFUNDED"]),
  occurredAt: z.string().datetime(),
});
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
