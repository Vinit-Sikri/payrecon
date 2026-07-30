import { MismatchReason, OrderStatus, PaymentStatus, ReconciliationState } from "@payrecon/shared";

/**
 * Pure business logic, deliberately decoupled from Prisma/Redis so it can be
 * unit tested without a database. Deals only in the two reconciliation
 * outcomes that come from successfully *evaluating* an event — MATCHED or
 * MISMATCHED (or PENDING while the gateway itself hasn't concluded yet).
 * FAILED and DEAD_LETTERED are orchestration-layer states set by
 * ReconciliationRunner/StreamConsumer when *processing itself* throws
 * (DB down, etc.) — this function never returns them.
 */

export interface MismatchDetail {
  reason: MismatchReason;
  detail: Record<string, unknown>;
}

export interface ReconciliationResult {
  state: ReconciliationState;
  mismatches: MismatchDetail[];
  orderStatusUpdate?: OrderStatus;
}

export interface ReconcilableOrder {
  id: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  createdAt: Date;
}

export interface ReconcilablePaymentEvent {
  amount: number;
  currency: string;
  gatewayStatus: PaymentStatus;
  receivedAt: Date;
}

export interface ReconcileInput {
  paymentEvent: ReconcilablePaymentEvent;
  order: ReconcilableOrder | null;
  delayThresholdMs: number;
}

export function reconcile(input: ReconcileInput): ReconciliationResult {
  const { paymentEvent, order, delayThresholdMs } = input;

  if (!order) {
    return {
      state: ReconciliationState.MISMATCHED,
      mismatches: [
        {
          reason: MismatchReason.MISSING_ORDER,
          detail: { message: "No order found for the orderId referenced by this payment event" },
        },
      ],
    };
  }

  const mismatches: MismatchDetail[] = [];

  if (paymentEvent.amount !== order.amount || paymentEvent.currency !== order.currency) {
    mismatches.push({
      reason: MismatchReason.AMOUNT_MISMATCH,
      detail: {
        expectedAmount: order.amount,
        actualAmount: paymentEvent.amount,
        expectedCurrency: order.currency,
        actualCurrency: paymentEvent.currency,
      },
    });
  }

  // Delay is measured from order creation to when we actually received the
  // webhook (not "now") — reconciliation/queue latency shouldn't count
  // against the gateway's delivery SLA.
  const delayMs = paymentEvent.receivedAt.getTime() - order.createdAt.getTime();
  if (delayMs > delayThresholdMs) {
    mismatches.push({
      reason: MismatchReason.DELAYED_WEBHOOK,
      detail: { delayMs, thresholdMs: delayThresholdMs },
    });
  }

  if (paymentEvent.gatewayStatus === PaymentStatus.SUCCESS && order.status === OrderStatus.PAID) {
    mismatches.push({
      reason: MismatchReason.DUPLICATE_PAYMENT,
      detail: { message: "Order is already PAID; a second successful payment event was received" },
    });
  }

  if (paymentEvent.gatewayStatus === PaymentStatus.REFUNDED && order.status !== OrderStatus.PAID) {
    mismatches.push({
      reason: MismatchReason.STATUS_CONFLICT,
      detail: { message: `Refund received for order in status ${order.status}, expected PAID` },
    });
  }

  if (mismatches.length > 0) {
    return { state: ReconciliationState.MISMATCHED, mismatches };
  }

  if (paymentEvent.gatewayStatus === PaymentStatus.PENDING) {
    return { state: ReconciliationState.PENDING, mismatches: [] };
  }

  if (paymentEvent.gatewayStatus === PaymentStatus.SUCCESS) {
    return { state: ReconciliationState.MATCHED, mismatches: [], orderStatusUpdate: OrderStatus.PAID };
  }

  if (paymentEvent.gatewayStatus === PaymentStatus.REFUNDED) {
    return { state: ReconciliationState.MATCHED, mismatches: [], orderStatusUpdate: OrderStatus.REFUNDED };
  }

  // FAILED: a legitimately failed payment, correctly recorded — matched,
  // no order mutation.
  return { state: ReconciliationState.MATCHED, mismatches: [] };
}
