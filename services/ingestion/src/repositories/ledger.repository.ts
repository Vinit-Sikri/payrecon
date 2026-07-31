import { prisma, type LedgerEntry, type LedgerEntryStatus } from "@payrecon/db";

export interface ListLedgerEntriesFilter {
  status?: LedgerEntryStatus;
  limit: number;
  cursor?: string;
}

export interface LedgerAccountBalance {
  accountType: string;
  direction: string;
  total: number;
}

export class LedgerRepository {
  list(filter: ListLedgerEntriesFilter): Promise<LedgerEntry[]> {
    return prisma.ledgerEntry.findMany({
      where: filter.status ? { status: filter.status } : undefined,
      take: filter.limit,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
    });
  }

  async aggregateBalance(): Promise<LedgerAccountBalance[]> {
    const rows = await prisma.ledgerEntry.groupBy({
      by: ["accountType", "direction"],
      _sum: { amount: true },
    });

    return rows.map((row) => ({
      accountType: row.accountType,
      direction: row.direction,
      total: row._sum.amount ?? 0,
    }));
  }

  /**
   * Flips the PENDING_SETTLEMENT ledger pair booked for a payment event to
   * SETTLED once a bank settlement record confirms the money actually
   * landed. Scoped to PENDING_SETTLEMENT so re-processing an already-settled
   * event (e.g. a re-uploaded file that somehow bypassed the batch-level
   * fileHash dedup) is a no-op rather than stomping settledAt again.
   */
  async settleForPaymentEvent(paymentEventId: string, settlementRecordId: string): Promise<void> {
    await prisma.ledgerEntry.updateMany({
      where: { paymentEventId, status: "PENDING_SETTLEMENT" },
      data: { status: "SETTLED", settlementRecordId, settledAt: new Date() },
    });
  }
}
