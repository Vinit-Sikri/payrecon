import { describe, expect, it } from "vitest";
import { MismatchReason, OrderStatus, PaymentStatus, ReconciliationState } from "@payrecon/shared";
import { reconcile, type ReconcilableOrder, type ReconcilablePaymentEvent } from "./reconciliation.service";

const DELAY_THRESHOLD_MS = 3_600_000; // 1 hour

function makeOrder(overrides: Partial<ReconcilableOrder> = {}): ReconcilableOrder {
  return {
    id: "order-1",
    amount: 5000,
    currency: "USD",
    status: OrderStatus.CREATED,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makePaymentEvent(overrides: Partial<ReconcilablePaymentEvent> = {}): ReconcilablePaymentEvent {
  return {
    amount: 5000,
    currency: "USD",
    gatewayStatus: PaymentStatus.SUCCESS,
    receivedAt: new Date("2026-01-01T00:05:00.000Z"), // 5 minutes after order creation
    ...overrides,
  };
}

describe("reconcile", () => {
  it("matches a successful payment that lines up with the order and marks the order PAID", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent({ gatewayStatus: PaymentStatus.SUCCESS }),
      order: makeOrder({ status: OrderStatus.CREATED }),
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.MATCHED);
    expect(result.mismatches).toHaveLength(0);
    expect(result.orderStatusUpdate).toBe(OrderStatus.PAID);
  });

  it("matches a failed payment without touching order status", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent({ gatewayStatus: PaymentStatus.FAILED }),
      order: makeOrder({ status: OrderStatus.CREATED }),
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.MATCHED);
    expect(result.mismatches).toHaveLength(0);
    expect(result.orderStatusUpdate).toBeUndefined();
  });

  it("flags a missing order as MISMATCHED / MISSING_ORDER", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent(),
      order: null,
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.MISMATCHED);
    expect(result.mismatches).toEqual([expect.objectContaining({ reason: MismatchReason.MISSING_ORDER })]);
  });

  it("flags an amount mismatch", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent({ amount: 4999 }),
      order: makeOrder({ amount: 5000 }),
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.MISMATCHED);
    expect(result.mismatches).toEqual([
      expect.objectContaining({
        reason: MismatchReason.AMOUNT_MISMATCH,
        detail: expect.objectContaining({ expectedAmount: 5000, actualAmount: 4999 }),
      }),
    ]);
  });

  it("flags a currency mismatch as AMOUNT_MISMATCH (same reason category)", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent({ currency: "EUR" }),
      order: makeOrder({ currency: "USD" }),
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.MISMATCHED);
    expect(result.mismatches[0]?.reason).toBe(MismatchReason.AMOUNT_MISMATCH);
  });

  it("flags a webhook that arrived after the delay threshold", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent({ receivedAt: new Date("2026-01-01T02:00:00.000Z") }), // 2h later
      order: makeOrder({ createdAt: new Date("2026-01-01T00:00:00.000Z") }),
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.MISMATCHED);
    expect(result.mismatches).toEqual([expect.objectContaining({ reason: MismatchReason.DELAYED_WEBHOOK })]);
  });

  it("does not flag a webhook that arrives just under the delay threshold", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent({ receivedAt: new Date("2026-01-01T00:59:00.000Z") }), // 59 min later
      order: makeOrder({ createdAt: new Date("2026-01-01T00:00:00.000Z") }),
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.MATCHED);
  });

  it("flags a second successful payment on an already-PAID order as a duplicate payment", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent({ gatewayStatus: PaymentStatus.SUCCESS }),
      order: makeOrder({ status: OrderStatus.PAID }),
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.MISMATCHED);
    expect(result.mismatches).toEqual([expect.objectContaining({ reason: MismatchReason.DUPLICATE_PAYMENT })]);
  });

  it("flags a refund against an order that was never PAID as a status conflict", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent({ gatewayStatus: PaymentStatus.REFUNDED }),
      order: makeOrder({ status: OrderStatus.CREATED }),
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.MISMATCHED);
    expect(result.mismatches).toEqual([expect.objectContaining({ reason: MismatchReason.STATUS_CONFLICT })]);
  });

  it("matches a refund against a PAID order and updates the order to REFUNDED", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent({ gatewayStatus: PaymentStatus.REFUNDED }),
      order: makeOrder({ status: OrderStatus.PAID }),
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.MATCHED);
    expect(result.orderStatusUpdate).toBe(OrderStatus.REFUNDED);
  });

  it("reports PENDING for a gateway-pending event with no other issues", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent({ gatewayStatus: PaymentStatus.PENDING }),
      order: makeOrder(),
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.PENDING);
    expect(result.mismatches).toHaveLength(0);
    expect(result.orderStatusUpdate).toBeUndefined();
  });

  it("still reports a mismatch for a pending event whose amount is wrong", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent({ gatewayStatus: PaymentStatus.PENDING, amount: 1 }),
      order: makeOrder({ amount: 5000 }),
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.MISMATCHED);
  });

  it("collects multiple simultaneous mismatches on a single event", () => {
    const result = reconcile({
      paymentEvent: makePaymentEvent({
        amount: 1,
        receivedAt: new Date("2026-01-01T03:00:00.000Z"),
      }),
      order: makeOrder({ amount: 5000, createdAt: new Date("2026-01-01T00:00:00.000Z") }),
      delayThresholdMs: DELAY_THRESHOLD_MS,
    });

    expect(result.state).toBe(ReconciliationState.MISMATCHED);
    const reasons = result.mismatches.map((m) => m.reason).sort();
    expect(reasons).toEqual([MismatchReason.AMOUNT_MISMATCH, MismatchReason.DELAYED_WEBHOOK].sort());
  });
});
