import { prisma } from "@payrecon/db";

export interface RecentMismatch {
  id: string;
  reason: string;
  detail: unknown;
  createdAt: Date;
  paymentEvent: {
    id: string;
    gatewayEventId: string;
    orderId: string | null;
    amount: number;
    currency: string;
    gatewayStatus: string;
  };
}

export class MismatchRepository {
  findRecent(limit: number): Promise<RecentMismatch[]> {
    return prisma.mismatch.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        paymentEvent: {
          select: {
            id: true,
            gatewayEventId: true,
            orderId: true,
            amount: true,
            currency: true,
            gatewayStatus: true,
          },
        },
      },
    });
  }
}
