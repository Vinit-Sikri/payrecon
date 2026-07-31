/**
 * Mirrors the enums defined in packages/db/prisma/schema.prisma. Kept as plain
 * TS objects (not imported from @prisma/client) so services like mock-gateway,
 * which never touch the database, don't need a Prisma dependency just for types.
 */
export const OrderStatus = {
  CREATED: "CREATED",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  PENDING: "PENDING",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const ReconciliationState = {
  PENDING: "PENDING",
  MATCHED: "MATCHED",
  MISMATCHED: "MISMATCHED",
  FAILED: "FAILED",
  DEAD_LETTERED: "DEAD_LETTERED",
} as const;
export type ReconciliationState = (typeof ReconciliationState)[keyof typeof ReconciliationState];

export const MismatchReason = {
  AMOUNT_MISMATCH: "AMOUNT_MISMATCH",
  MISSING_ORDER: "MISSING_ORDER",
  DUPLICATE_PAYMENT: "DUPLICATE_PAYMENT",
  DELAYED_WEBHOOK: "DELAYED_WEBHOOK",
  STATUS_CONFLICT: "STATUS_CONFLICT",
} as const;
export type MismatchReason = (typeof MismatchReason)[keyof typeof MismatchReason];

export const LedgerAccountType = {
  GATEWAY_RECEIVABLE: "GATEWAY_RECEIVABLE",
  MERCHANT_PAYABLE: "MERCHANT_PAYABLE",
} as const;
export type LedgerAccountType = (typeof LedgerAccountType)[keyof typeof LedgerAccountType];

export const LedgerDirection = {
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
} as const;
export type LedgerDirection = (typeof LedgerDirection)[keyof typeof LedgerDirection];

export const LedgerEntryStatus = {
  PENDING_SETTLEMENT: "PENDING_SETTLEMENT",
  SETTLED: "SETTLED",
} as const;
export type LedgerEntryStatus = (typeof LedgerEntryStatus)[keyof typeof LedgerEntryStatus];

export const SettlementBatchStatus = {
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type SettlementBatchStatus = (typeof SettlementBatchStatus)[keyof typeof SettlementBatchStatus];

export const SettlementMatchStatus = {
  MATCHED: "MATCHED",
  AMOUNT_MISMATCH: "AMOUNT_MISMATCH",
  UNMATCHED: "UNMATCHED",
} as const;
export type SettlementMatchStatus = (typeof SettlementMatchStatus)[keyof typeof SettlementMatchStatus];
