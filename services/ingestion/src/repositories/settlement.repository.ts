import { prisma, type SettlementBatch, type SettlementBatchStatus, type SettlementRecord } from "@payrecon/db";
import type { SettlementMatchStatus } from "@payrecon/shared";

export interface CreateSettlementRecordData {
  settlementBatchId: string;
  gatewayEventId: string;
  amount: number;
  currency: string;
  settledAt: Date;
  matchStatus: SettlementMatchStatus;
  paymentEventId: string | null;
}

export interface SettlementBatchCounts {
  totalRecords: number;
  matchedCount: number;
  mismatchedCount: number;
  unmatchedCount: number;
}

export type SettlementBatchWithRecords = SettlementBatch & { records: SettlementRecord[] };

export class SettlementRepository {
  findBatchByHash(fileHash: string): Promise<SettlementBatch | null> {
    return prisma.settlementBatch.findUnique({ where: { fileHash } });
  }

  createBatch(filename: string, fileHash: string): Promise<SettlementBatch> {
    return prisma.settlementBatch.create({ data: { filename, fileHash } });
  }

  createRecord(data: CreateSettlementRecordData): Promise<SettlementRecord> {
    return prisma.settlementRecord.create({ data });
  }

  finalizeBatch(
    batchId: string,
    counts: SettlementBatchCounts,
    status: SettlementBatchStatus,
  ): Promise<SettlementBatch> {
    return prisma.settlementBatch.update({
      where: { id: batchId },
      data: {
        status,
        totalRecords: counts.totalRecords,
        matchedCount: counts.matchedCount,
        mismatchedCount: counts.mismatchedCount,
        unmatchedCount: counts.unmatchedCount,
      },
    });
  }

  list(limit: number): Promise<SettlementBatch[]> {
    return prisma.settlementBatch.findMany({ take: limit, orderBy: { uploadedAt: "desc" } });
  }

  findByIdWithRecords(id: string): Promise<SettlementBatchWithRecords | null> {
    return prisma.settlementBatch.findUnique({
      where: { id },
      include: { records: { orderBy: { createdAt: "asc" } } },
    });
  }
}
