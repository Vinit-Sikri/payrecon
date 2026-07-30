import type { FastifyBaseLogger } from "fastify";
import { signPayload, type WebhookPayload } from "@payrecon/shared";
import { backoffMs, sleep } from "../lib/delay";

export interface WebhookSenderOptions {
  webhookUrl: string;
  hmacSecret: string;
  maxAttempts: number;
}

/**
 * Delivers a signed webhook to the ingestion service, retrying on failure
 * the way a real payment gateway would (it doesn't know or care whether the
 * receiver already processed an earlier attempt — that's the receiver's
 * idempotency problem to solve).
 */
export class WebhookSender {
  constructor(
    private readonly options: WebhookSenderOptions,
    private readonly logger: FastifyBaseLogger,
  ) {}

  async send(payload: WebhookPayload): Promise<void> {
    const body = JSON.stringify(payload);
    const signature = signPayload(body, this.options.hmacSecret);

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        const response = await fetch(this.options.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-payrecon-signature": signature,
          },
          body,
        });

        if (response.ok) {
          this.logger.info({ gatewayEventId: payload.gatewayEventId, attempt }, "webhook delivered");
          return;
        }

        this.logger.warn(
          { gatewayEventId: payload.gatewayEventId, attempt, status: response.status },
          "webhook delivery rejected by receiver",
        );
      } catch (err) {
        this.logger.warn({ err, gatewayEventId: payload.gatewayEventId, attempt }, "webhook delivery attempt failed");
      }

      if (attempt < this.options.maxAttempts) {
        await sleep(backoffMs(attempt));
      }
    }

    this.logger.error(
      { gatewayEventId: payload.gatewayEventId, attempts: this.options.maxAttempts },
      "webhook delivery exhausted all attempts",
    );
  }
}
