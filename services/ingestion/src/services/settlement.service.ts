import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { NotFoundError, SettlementBatchStatus, SettlementMatchStatus, ValidationError } from "@payrecon/shared";
import type { SettlementBatch } from "@payrecon/db";
import type { PaymentEventRepository } from "../repositories/payment-event.repository";
import type { LedgerRepository } from "../repositories/ledger.repository";
import type { SettlementBatchWithRecords, SettlementRepository } from "../repositories/settlement.repository";
import { matchSettlementRecord } from "./settlement-matcher.service";

interface SettlementCsvRow {
  gatewayEventId: string;
  amount: string;
  currency: string;
  settledAt: string;
}

/**
 * Processes a settlement file synchronously, inside the HTTP request — this
 * is a bounded, human-triggered, one-shot upload (dozens-hundreds of rows
 * for demo purposes), not a candidate for the Redis Streams pipeline the
 * rest of this system uses for the high-volume webhook path. A background
 * job would be more "production" for genuinely large files but is
 * deliberately out of scope here.
 */
export class SettlementService {
  constructor(
    private readonly settlementRepository: SettlementRepository,
    private readonly paymentEventRepository: PaymentEventRepository,
    private readonly ledgerRepository: LedgerRepository,
  ) {}

  async processUpload(fileBuffer: Buffer, filename: string): Promise<SettlementBatch> {
    const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

    const existing = await this.settlementRepository.findBatchByHash(fileHash);
    if (existing) {
      return existing;
    }

    const rows = this.parseCsv(fileBuffer);
    const batch = await this.settlementRepository.createBatch(filename, fileHash);

    let matchedCount = 0;
    let mismatchedCount = 0;
    let unmatchedCount = 0;

    for (const row of rows) {
      const paymentEvent = await this.paymentEventRepository.findByGatewayEventId(row.gatewayEventId);
      const matchStatus = matchSettlementRecord(
        { amount: row.amount, currency: row.currency },
        paymentEvent ? { amount: paymentEvent.amount, currency: paymentEvent.currency } : null,
      );

      const record = await this.settlementRepository.createRecord({
        settlementBatchId: batch.id,
        gatewayEventId: row.gatewayEventId,
        amount: row.amount,
        currency: row.currency,
        settledAt: row.settledAt,
        matchStatus,
        paymentEventId: paymentEvent?.id ?? null,
      });

      if (matchStatus === SettlementMatchStatus.MATCHED && paymentEvent) {
        await this.ledgerRepository.settleForPaymentEvent(paymentEvent.id, record.id);
        matchedCount += 1;
      } else if (matchStatus === SettlementMatchStatus.AMOUNT_MISMATCH) {
        mismatchedCount += 1;
      } else {
        unmatchedCount += 1;
      }
    }

    return this.settlementRepository.finalizeBatch(
      batch.id,
      { totalRecords: rows.length, matchedCount, mismatchedCount, unmatchedCount },
      SettlementBatchStatus.COMPLETED,
    );
  }

  list(limit: number): Promise<SettlementBatch[]> {
    return this.settlementRepository.list(limit);
  }

  async getById(id: string): Promise<SettlementBatchWithRecords> {
    const batch = await this.settlementRepository.findByIdWithRecords(id);
    if (!batch) {
      throw new NotFoundError(`Settlement batch ${id} not found`);
    }
    return batch;
  }

  private parseCsv(fileBuffer: Buffer): Array<{ gatewayEventId: string; amount: number; currency: string; settledAt: Date }> {
    let rows: SettlementCsvRow[];
    try {
      rows = parse(fileBuffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch (error) {
      throw new ValidationError("Could not parse settlement file as CSV", { error: (error as Error).message });
    }

    return rows.map((row, index) => {
      const amount = Number(row.amount);
      const settledAt = new Date(row.settledAt);

      if (!row.gatewayEventId || !row.currency || !Number.isFinite(amount) || Number.isNaN(settledAt.getTime())) {
        throw new ValidationError(`Invalid settlement CSV row at index ${index}`, { row });
      }

      return { gatewayEventId: row.gatewayEventId, amount, currency: row.currency, settledAt };
    });
  }
}
