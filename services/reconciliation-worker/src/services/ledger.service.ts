import { LedgerAccountType, LedgerDirection, OrderStatus } from "@payrecon/shared";

/**
 * Pure double-entry booking logic, deliberately decoupled from Prisma so it
 * can be unit tested without a database — same shape as reconcile(). Only
 * called when reconcile() actually moved money (orderStatusUpdate is PAID or
 * REFUNDED); a MATCHED-but-FAILED payment never reaches this function.
 */

export interface LedgerEntryDraft {
  accountType: LedgerAccountType;
  direction: LedgerDirection;
  amount: number;
  currency: string;
}

export interface CreateLedgerEntriesInput {
  amount: number;
  currency: string;
  orderStatusUpdate: OrderStatus;
}

/**
 * v1 keeps to two accounts: GATEWAY_RECEIVABLE (money owed to the platform by
 * the gateway) and MERCHANT_PAYABLE (money the platform owes the merchant).
 * A refund mirrors the same pair rather than a dedicated refund-payable
 * account — a documented simplification, not a missing feature.
 */
export function createLedgerEntries(input: CreateLedgerEntriesInput): LedgerEntryDraft[] {
  const { amount, currency, orderStatusUpdate } = input;

  if (orderStatusUpdate !== OrderStatus.PAID && orderStatusUpdate !== OrderStatus.REFUNDED) {
    return [];
  }

  return [
    { accountType: LedgerAccountType.GATEWAY_RECEIVABLE, direction: LedgerDirection.DEBIT, amount, currency },
    { accountType: LedgerAccountType.MERCHANT_PAYABLE, direction: LedgerDirection.CREDIT, amount, currency },
  ];
}
