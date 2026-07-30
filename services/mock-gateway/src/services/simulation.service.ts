import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { WebhookPayload } from "@payrecon/shared";
import type { Env } from "../config/env";
import { randomDelayMs } from "../lib/delay";
import { decideOutcome } from "./outcome.service";
import { WebhookSender } from "./webhook-sender.service";

export interface SimulatePaymentInput {
  orderId: string;
  amount: number;
  currency: string;
}

export interface SimulatePaymentResult {
  gatewayPaymentId: string;
  status: "PROCESSING";
}

/**
 * Orchestrates the "chaos" the mock gateway is supposed to inject:
 *  - random delay before the first webhook (independent per payment, so
 *    concurrent payments naturally arrive out of order — no special
 *    reordering logic needed)
 *  - random SUCCESS/FAILED/PENDING outcome
 *  - random duplicate redelivery of the same event id
 *  - per-delivery-attempt retries with backoff (handled by WebhookSender)
 */
export class SimulationService {
  private readonly sender: WebhookSender;
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(
    private readonly env: Env,
    private readonly logger: FastifyBaseLogger,
  ) {
    this.sender = new WebhookSender(
      {
        webhookUrl: env.INGESTION_WEBHOOK_URL,
        hmacSecret: env.WEBHOOK_HMAC_SECRET,
        maxAttempts: env.WEBHOOK_MAX_ATTEMPTS,
      },
      logger,
    );
  }

  simulatePayment(input: SimulatePaymentInput): SimulatePaymentResult {
    const gatewayEventId = randomUUID();
    const delay = randomDelayMs(this.env.MIN_DELAY_MS, this.env.MAX_DELAY_MS);

    this.schedule(delay, () => this.deliver(gatewayEventId, input));

    return { gatewayPaymentId: gatewayEventId, status: "PROCESSING" };
  }

  private async deliver(gatewayEventId: string, input: SimulatePaymentInput): Promise<void> {
    const status = decideOutcome(this.env);
    const payload: WebhookPayload = {
      gatewayEventId,
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      status,
      occurredAt: new Date().toISOString(),
    };

    await this.sender.send(payload);

    if (Math.random() < this.env.DUPLICATE_RATE) {
      const dupDelay = randomDelayMs(this.env.MIN_DELAY_MS, this.env.MAX_DELAY_MS);
      this.logger.info({ gatewayEventId, dupDelay }, "scheduling duplicate webhook delivery");
      this.schedule(dupDelay, () => this.sender.send({ ...payload, occurredAt: new Date().toISOString() }));
    }
  }

  private schedule(delayMs: number, fn: () => Promise<void>): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void fn();
    }, delayMs);
    this.timers.add(timer);
  }

  /** Clears pending simulated deliveries so the process can exit cleanly on shutdown. */
  shutdown(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
