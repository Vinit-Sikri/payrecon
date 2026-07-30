import {
  UnauthorizedError,
  ValidationError,
  verifySignature,
  webhookPayloadSchema,
  type StreamProducer,
  type WebhookPayload,
} from "@payrecon/shared";
import type { OrderRepository } from "../repositories/order.repository";
import type { PaymentEventRepository } from "../repositories/payment-event.repository";
import type { IdempotencyService } from "./idempotency.service";

export interface WebhookServiceDeps {
  hmacSecret: string;
  idempotencyService: IdempotencyService;
  orderRepository: OrderRepository;
  paymentEventRepository: PaymentEventRepository;
  streamProducer: StreamProducer;
}

export interface WebhookProcessResult {
  status: "accepted" | "duplicate";
  paymentEventId: string;
}

export class WebhookService {
  constructor(private readonly deps: WebhookServiceDeps) {}

  async processWebhook(rawBody: Buffer, signatureHeader: string | undefined): Promise<WebhookProcessResult> {
    if (!verifySignature(rawBody, this.deps.hmacSecret, signatureHeader)) {
      throw new UnauthorizedError("Invalid webhook signature");
    }

    const payload = this.parsePayload(rawBody);

    // Fast path: Redis SETNX. ~15% of the mock gateway's deliveries are
    // intentional duplicates, and this must short-circuit them without
    // touching Postgres or re-publishing to the stream.
    const isNew = await this.deps.idempotencyService.markIfNew(payload.gatewayEventId);
    if (!isNew) {
      const existing = await this.deps.paymentEventRepository.findByGatewayEventId(payload.gatewayEventId);
      return { status: "duplicate", paymentEventId: existing?.id ?? payload.gatewayEventId };
    }

    // The FK on PaymentEvent.orderId means we can't blindly store an orderId
    // that doesn't exist yet (webhook arriving before order creation is one
    // of the out-of-order cases this system models). Resolve to null when
    // missing — the reconciliation worker re-checks by the order id embedded
    // in rawPayload and backfills this column if the order shows up later.
    const order = await this.deps.orderRepository.findById(payload.orderId);
    const paymentEvent = await this.deps.paymentEventRepository.upsertPending(payload, order ? order.id : null);

    await this.deps.streamProducer.publish({ paymentEventId: paymentEvent.id });

    return { status: "accepted", paymentEventId: paymentEvent.id };
  }

  private parsePayload(rawBody: Buffer): WebhookPayload {
    let json: unknown;
    try {
      json = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new ValidationError("Webhook body is not valid JSON");
    }

    const parsed = webhookPayloadSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Invalid webhook payload", parsed.error.flatten());
    }

    return parsed.data;
  }
}
