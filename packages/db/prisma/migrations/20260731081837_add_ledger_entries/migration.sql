-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('GATEWAY_RECEIVABLE', 'MERCHANT_PAYABLE');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerEntryStatus" AS ENUM ('PENDING_SETTLEMENT', 'SETTLED');

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "paymentEventId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "accountType" "LedgerAccountType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "LedgerEntryStatus" NOT NULL DEFAULT 'PENDING_SETTLEMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_entries_paymentEventId_idx" ON "ledger_entries"("paymentEventId");

-- CreateIndex
CREATE INDEX "ledger_entries_status_idx" ON "ledger_entries"("status");

-- CreateIndex
CREATE INDEX "ledger_entries_accountType_idx" ON "ledger_entries"("accountType");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_paymentEventId_fkey" FOREIGN KEY ("paymentEventId") REFERENCES "payment_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
