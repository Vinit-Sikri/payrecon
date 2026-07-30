import { prisma, type PaymentEvent } from "@payrecon/db";
import type { ReconciliationState } from "@payrecon/shared";

export class PaymentEventRepository {
  findById(id: string): Promise<PaymentEvent | null> {
    return prisma.paymentEvent.findUnique({ where: { id } });
  }

  attachOrder(id: string, orderId: string): Promise<PaymentEvent> {
    return prisma.paymentEvent.update({ where: { id }, data: { orderId } });
  }

  markProcessed(id: string, state: ReconciliationState): Promise<PaymentEvent> {
    return prisma.paymentEvent.update({
      where: { id },
      data: { reconciliationState: state, processedAt: new Date() },
    });
  }

  incrementAttempts(id: string, lastError: string): Promise<PaymentEvent> {
    return prisma.paymentEvent.update({
      where: { id },
      data: { attempts: { increment: 1 }, lastError },
    });
  }

  markFailed(id: string): Promise<PaymentEvent> {
    return prisma.paymentEvent.update({ where: { id }, data: { reconciliationState: "FAILED" } });
  }

  markDeadLettered(id: string): Promise<PaymentEvent> {
    return prisma.paymentEvent.update({
      where: { id },
      data: { reconciliationState: "DEAD_LETTERED", processedAt: new Date() },
    });
  }
}
