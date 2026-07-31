import { SettlementMatchStatus } from "@payrecon/shared";

/**
 * Pure matching logic, deliberately decoupled from Prisma/CSV-parsing so it
 * can be unit tested without a database — same shape as reconcile(). A
 * settlement record is the bank's ground truth that money actually moved;
 * this compares it against what the webhook already told us (the
 * PaymentEvent), which can disagree in three ways: no such payment on our
 * side at all, an amount/currency mismatch, or a clean match.
 */

export interface SettlementRecordInput {
  amount: number;
  currency: string;
}

export interface MatchablePaymentEvent {
  amount: number;
  currency: string;
}

export function matchSettlementRecord(
  record: SettlementRecordInput,
  paymentEvent: MatchablePaymentEvent | null,
): SettlementMatchStatus {
  if (!paymentEvent) {
    return SettlementMatchStatus.UNMATCHED;
  }

  if (record.amount !== paymentEvent.amount || record.currency !== paymentEvent.currency) {
    return SettlementMatchStatus.AMOUNT_MISMATCH;
  }

  return SettlementMatchStatus.MATCHED;
}
