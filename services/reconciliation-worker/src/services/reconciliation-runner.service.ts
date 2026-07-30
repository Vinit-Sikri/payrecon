import type { FastifyBaseLogger } from "fastify";
import type { OrderRepository } from "../repositories/order.repository";
import type { PaymentEventRepository } from "../repositories/payment-event.repository";
import type { MismatchRepository } from "../repositories/mismatch.repository";
import { reconcile } from "./reconciliation.service";

export interface ReconciliationRunnerOptions {
  delayThresholdMs: number;
}

/**
 * Loads a PaymentEvent + its Order from Postgres, runs the pure reconcile()
 * logic, and persists the outcome. Any exception here (DB error, etc.)
 * propagates to the caller (StreamConsumer), which treats it as a transient
 * processing failure — not a business mismatch — and retries.
 */
export class ReconciliationRunner {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly paymentEventRepository: PaymentEventRepository,
    private readonly mismatchRepository: MismatchRepository,
    private readonly logger: FastifyBaseLogger,
    private readonly options: ReconciliationRunnerOptions,
  ) {}

  async run(paymentEventId: string): Promise<void> {
    const paymentEvent = await this.paymentEventRepository.findById(paymentEventId);
    if (!paymentEvent) {
      // Can legitimately happen: a retry-scheduled message for an event that
      // was already dead-lettered/reprocessed by another path. Not an error.
      this.logger.warn({ paymentEventId }, "payment event not found, skipping");
      return;
    }

    const order = await this.resolveOrder(paymentEvent.id, paymentEvent.orderId, paymentEvent.rawPayload);

    const result = reconcile({
      paymentEvent: {
        amount: paymentEvent.amount,
        currency: paymentEvent.currency,
        gatewayStatus: paymentEvent.gatewayStatus,
        receivedAt: paymentEvent.receivedAt,
      },
      order,
      delayThresholdMs: this.options.delayThresholdMs,
    });

    if (result.mismatches.length > 0) {
      await this.mismatchRepository.createMany(paymentEvent.id, result.mismatches);
    }

    if (result.orderStatusUpdate && order) {
      await this.orderRepository.updateStatus(order.id, result.orderStatusUpdate);
    }

    await this.paymentEventRepository.markProcessed(paymentEvent.id, result.state);

    this.logger.info(
      { paymentEventId, state: result.state, mismatchCount: result.mismatches.length },
      "reconciliation complete",
    );
  }

  /**
   * The FK-backed orderId column is only set once the order exists at
   * ingestion time (see ingestion's WebhookService). If it's still null,
   * re-check by the order id embedded in the raw payload — the order may
   * have been created since, which is exactly the "delayed order creation"
   * out-of-order case this system needs to handle. Backfill the column when
   * found so we don't repeat this lookup on subsequent retries.
   */
  private async resolveOrder(
    paymentEventId: string,
    orderId: string | null,
    rawPayload: unknown,
  ): ReturnType<OrderRepository["findById"]> {
    if (orderId) {
      return this.orderRepository.findById(orderId);
    }

    const intendedOrderId = this.extractOrderId(rawPayload);
    if (!intendedOrderId) {
      return null;
    }

    const order = await this.orderRepository.findById(intendedOrderId);
    if (order) {
      await this.paymentEventRepository.attachOrder(paymentEventId, order.id);
    }
    return order;
  }

  private extractOrderId(rawPayload: unknown): string | null {
    if (rawPayload && typeof rawPayload === "object" && "orderId" in rawPayload) {
      const value = (rawPayload as { orderId?: unknown }).orderId;
      return typeof value === "string" ? value : null;
    }
    return null;
  }
}
