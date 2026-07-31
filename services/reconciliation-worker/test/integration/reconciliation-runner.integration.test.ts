import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, disconnectPrisma } from "@payrecon/db";
import { OrderStatus, PaymentStatus, ReconciliationState, MismatchReason } from "@payrecon/shared";
import { OrderRepository } from "../../src/repositories/order.repository";
import { PaymentEventRepository } from "../../src/repositories/payment-event.repository";
import { MismatchRepository } from "../../src/repositories/mismatch.repository";
import { LedgerRepository } from "../../src/repositories/ledger.repository";
import { ReconciliationRunner } from "../../src/services/reconciliation-runner.service";

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe("ReconciliationRunner (integration)", () => {
  const orderRepository = new OrderRepository();
  const paymentEventRepository = new PaymentEventRepository();
  const mismatchRepository = new MismatchRepository();
  const ledgerRepository = new LedgerRepository();
  const runner = new ReconciliationRunner(
    orderRepository,
    paymentEventRepository,
    mismatchRepository,
    ledgerRepository,
    noopLogger,
    { delayThresholdMs: 3_600_000 },
  );

  beforeEach(async () => {
    await prisma.ledgerEntry.deleteMany();
    await prisma.settlementRecord.deleteMany();
    await prisma.settlementBatch.deleteMany();
    await prisma.mismatch.deleteMany();
    await prisma.paymentEvent.deleteMany();
    await prisma.order.deleteMany();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("marks a matching successful payment MATCHED and flips the order to PAID", async () => {
    const order = await prisma.order.create({ data: { amount: 5000, currency: "USD" } });
    const event = await prisma.paymentEvent.create({
      data: {
        gatewayEventId: "evt-matched-1",
        idempotencyKey: "evt-matched-1",
        orderId: order.id,
        amount: 5000,
        currency: "USD",
        gatewayStatus: PaymentStatus.SUCCESS,
        rawPayload: { orderId: order.id },
        receivedAt: new Date(),
      },
    });

    await runner.run(event.id);

    const updatedEvent = await prisma.paymentEvent.findUniqueOrThrow({ where: { id: event.id } });
    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const ledgerEntries = await prisma.ledgerEntry.findMany({ where: { paymentEventId: event.id } });

    expect(updatedEvent.reconciliationState).toBe(ReconciliationState.MATCHED);
    expect(updatedEvent.processedAt).not.toBeNull();
    expect(updatedOrder.status).toBe(OrderStatus.PAID);

    expect(ledgerEntries).toHaveLength(2);
    const debit = ledgerEntries.find((e) => e.direction === "DEBIT");
    const credit = ledgerEntries.find((e) => e.direction === "CREDIT");
    expect(debit?.accountType).toBe("GATEWAY_RECEIVABLE");
    expect(credit?.accountType).toBe("MERCHANT_PAYABLE");
    expect(debit?.amount).toBe(5000);
    expect(credit?.amount).toBe(5000);
  });

  it("books no ledger entries for a legitimately-FAILED payment (MATCHED but no money moved)", async () => {
    const order = await prisma.order.create({ data: { amount: 5000, currency: "USD" } });
    const event = await prisma.paymentEvent.create({
      data: {
        gatewayEventId: "evt-failed-1",
        idempotencyKey: "evt-failed-1",
        orderId: order.id,
        amount: 5000,
        currency: "USD",
        gatewayStatus: PaymentStatus.FAILED,
        rawPayload: { orderId: order.id },
        receivedAt: new Date(),
      },
    });

    await runner.run(event.id);

    const updatedEvent = await prisma.paymentEvent.findUniqueOrThrow({ where: { id: event.id } });
    const ledgerEntries = await prisma.ledgerEntry.findMany({ where: { paymentEventId: event.id } });

    expect(updatedEvent.reconciliationState).toBe(ReconciliationState.MATCHED);
    expect(ledgerEntries).toHaveLength(0);
  });

  it("marks an amount mismatch MISMATCHED and persists a Mismatch row, without mutating order status", async () => {
    const order = await prisma.order.create({ data: { amount: 5000, currency: "USD" } });
    const event = await prisma.paymentEvent.create({
      data: {
        gatewayEventId: "evt-mismatch-1",
        idempotencyKey: "evt-mismatch-1",
        orderId: order.id,
        amount: 4000,
        currency: "USD",
        gatewayStatus: PaymentStatus.SUCCESS,
        rawPayload: { orderId: order.id },
        receivedAt: new Date(),
      },
    });

    await runner.run(event.id);

    const updatedEvent = await prisma.paymentEvent.findUniqueOrThrow({ where: { id: event.id } });
    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const mismatches = await prisma.mismatch.findMany({ where: { paymentEventId: event.id } });

    expect(updatedEvent.reconciliationState).toBe(ReconciliationState.MISMATCHED);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]?.reason).toBe(MismatchReason.AMOUNT_MISMATCH);
    expect(updatedOrder.status).toBe(OrderStatus.CREATED);
  });

  it("backfills orderId once the order shows up after the webhook did (out-of-order case)", async () => {
    // Payment event arrives with orderId still null (order didn't exist at
    // ingestion time) — the intended order id lives only in rawPayload.
    const intendedOrderId = crypto.randomUUID();
    const event = await prisma.paymentEvent.create({
      data: {
        gatewayEventId: "evt-delayed-order-1",
        idempotencyKey: "evt-delayed-order-1",
        orderId: null,
        amount: 2500,
        currency: "USD",
        gatewayStatus: PaymentStatus.SUCCESS,
        rawPayload: { orderId: intendedOrderId },
        receivedAt: new Date(),
      },
    });

    // First run: order genuinely doesn't exist yet.
    await runner.run(event.id);
    const afterFirstRun = await prisma.paymentEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(afterFirstRun.reconciliationState).toBe(ReconciliationState.MISMATCHED);
    expect(afterFirstRun.orderId).toBeNull();

    const mismatchesAfterFirstRun = await prisma.mismatch.findMany({ where: { paymentEventId: event.id } });
    expect(mismatchesAfterFirstRun[0]?.reason).toBe(MismatchReason.MISSING_ORDER);

    // Order shows up late (the out-of-order scenario the mock gateway simulates).
    await prisma.order.create({ data: { id: intendedOrderId, amount: 2500, currency: "USD" } });

    // Second run (simulating a retry): should now find + backfill + reconcile successfully.
    await runner.run(event.id);
    const afterSecondRun = await prisma.paymentEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(afterSecondRun.orderId).toBe(intendedOrderId);
    expect(afterSecondRun.reconciliationState).toBe(ReconciliationState.MATCHED);
  });

  it("flags a second SUCCESS event against an already-PAID order as a duplicate payment", async () => {
    const order = await prisma.order.create({ data: { amount: 3000, currency: "USD", status: OrderStatus.PAID } });
    const event = await prisma.paymentEvent.create({
      data: {
        gatewayEventId: "evt-duplicate-1",
        idempotencyKey: "evt-duplicate-1",
        orderId: order.id,
        amount: 3000,
        currency: "USD",
        gatewayStatus: PaymentStatus.SUCCESS,
        rawPayload: { orderId: order.id },
        receivedAt: new Date(),
      },
    });

    await runner.run(event.id);

    const mismatches = await prisma.mismatch.findMany({ where: { paymentEventId: event.id } });
    expect(mismatches[0]?.reason).toBe(MismatchReason.DUPLICATE_PAYMENT);
  });
});
