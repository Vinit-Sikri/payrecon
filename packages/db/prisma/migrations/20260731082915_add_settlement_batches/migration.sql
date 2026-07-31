-- CreateEnum
CREATE TYPE "SettlementBatchStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SettlementMatchStatus" AS ENUM ('MATCHED', 'AMOUNT_MISMATCH', 'UNMATCHED');

-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "settlementRecordId" TEXT;

-- CreateTable
CREATE TABLE "settlement_batches" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SettlementBatchStatus" NOT NULL DEFAULT 'PROCESSING',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "mismatchedCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "settlement_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_records" (
    "id" TEXT NOT NULL,
    "settlementBatchId" TEXT NOT NULL,
    "gatewayEventId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL,
    "matchStatus" "SettlementMatchStatus" NOT NULL,
    "paymentEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "settlement_batches_fileHash_key" ON "settlement_batches"("fileHash");

-- CreateIndex
CREATE INDEX "settlement_records_settlementBatchId_idx" ON "settlement_records"("settlementBatchId");

-- CreateIndex
CREATE INDEX "settlement_records_gatewayEventId_idx" ON "settlement_records"("gatewayEventId");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_settlementRecordId_fkey" FOREIGN KEY ("settlementRecordId") REFERENCES "settlement_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_settlementBatchId_fkey" FOREIGN KEY ("settlementBatchId") REFERENCES "settlement_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_paymentEventId_fkey" FOREIGN KEY ("paymentEventId") REFERENCES "payment_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
