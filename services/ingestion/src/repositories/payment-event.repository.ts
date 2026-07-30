import { prisma, Prisma, type PaymentEvent } from "@payrecon/db";
import type { WebhookPayload } from "@payrecon/shared";

export interface ReconciliationStateCount {
  reconciliationState: string;
  count: number;
}

export class PaymentEventRepository {
  findByGatewayEventId(gatewayEventId: string): Promise<PaymentEvent | null> {
    return prisma.paymentEvent.findUnique({ where: { gatewayEventId } });
  }

  async countByReconciliationState(): Promise<ReconciliationStateCount[]> {
    const rows = await prisma.paymentEvent.groupBy({
      by: ["reconciliationState"],
      _count: { _all: true },
    });

    return rows.map((row) => ({
      reconciliationState: row.reconciliationState,
      count: row._count._all,
    }));
  }

  /**
   * Idempotent create keyed on gatewayEventId — the DB-level backstop behind
   * the Redis SETNX fast path (see IdempotencyService). `orderId` is passed
   * in already resolved to null when the order doesn't exist yet, because
   * the column has a real FK constraint and would otherwise reject the
   * insert outright on a genuinely missing order.
   */
  upsertPending(payload: WebhookPayload, orderId: string | null): Promise<PaymentEvent> {
    return prisma.paymentEvent.upsert({
      where: { gatewayEventId: payload.gatewayEventId },
      create: {
        gatewayEventId: payload.gatewayEventId,
        idempotencyKey: payload.gatewayEventId,
        orderId,
        amount: payload.amount,
        currency: payload.currency,
        gatewayStatus: payload.status,
        rawPayload: payload as unknown as Prisma.InputJsonValue,
        receivedAt: new Date(payload.occurredAt),
      },
      update: {},
    });
  }
}
