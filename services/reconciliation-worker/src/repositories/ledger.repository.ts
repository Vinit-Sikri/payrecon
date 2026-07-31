import { Prisma } from "@payrecon/db";
import type { LedgerEntryDraft } from "../services/ledger.service";

export class LedgerRepository {
  createMany(
    tx: Prisma.TransactionClient,
    paymentEventId: string,
    orderId: string,
    entries: LedgerEntryDraft[],
  ): Promise<Prisma.BatchPayload> {
    return tx.ledgerEntry.createMany({
      data: entries.map((entry) => ({
        paymentEventId,
        orderId,
        accountType: entry.accountType,
        direction: entry.direction,
        amount: entry.amount,
        currency: entry.currency,
      })),
    });
  }
}
