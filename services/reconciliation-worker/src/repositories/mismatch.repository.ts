import { prisma, Prisma } from "@payrecon/db";
import type { MismatchDetail } from "../services/reconciliation.service";

export class MismatchRepository {
  async createMany(paymentEventId: string, mismatches: MismatchDetail[]): Promise<void> {
    if (mismatches.length === 0) {
      return;
    }

    await prisma.mismatch.createMany({
      data: mismatches.map((m) => ({
        paymentEventId,
        reason: m.reason,
        detail: m.detail as Prisma.InputJsonValue,
      })),
    });
  }
}
