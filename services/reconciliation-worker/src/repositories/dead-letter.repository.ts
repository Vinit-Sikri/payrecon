import { prisma, Prisma, type DeadLetterEvent } from "@payrecon/db";

export interface CreateDeadLetterInput {
  paymentEventId: string;
  payload: unknown;
  reason: string;
  attempts: number;
}

export class DeadLetterRepository {
  create(input: CreateDeadLetterInput): Promise<DeadLetterEvent> {
    return prisma.deadLetterEvent.create({
      data: {
        paymentEventId: input.paymentEventId,
        payload: input.payload as Prisma.InputJsonValue,
        reason: input.reason,
        attempts: input.attempts,
      },
    });
  }
}
