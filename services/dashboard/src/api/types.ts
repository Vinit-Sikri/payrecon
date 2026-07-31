export type ReconciliationState = "PENDING" | "MATCHED" | "MISMATCHED" | "FAILED" | "DEAD_LETTERED";
export type OrderStatus = "CREATED" | "PAID" | "CANCELLED" | "REFUNDED";
export type LedgerEntryStatus = "PENDING_SETTLEMENT" | "SETTLED";
export type SettlementBatchStatus = "PROCESSING" | "COMPLETED" | "FAILED";
export type SettlementMatchStatus = "MATCHED" | "AMOUNT_MISMATCH" | "UNMATCHED";

export interface Order {
  id: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationSummary {
  counts: Record<ReconciliationState, number>;
  total: number;
}

export interface Mismatch {
  id: string;
  reason: string;
  detail: unknown;
  createdAt: string;
  paymentEvent: {
    id: string;
    gatewayEventId: string;
    orderId: string | null;
    amount: number;
    currency: string;
    gatewayStatus: string;
  };
}

export interface LedgerEntry {
  id: string;
  paymentEventId: string;
  orderId: string;
  accountType: "GATEWAY_RECEIVABLE" | "MERCHANT_PAYABLE";
  direction: "DEBIT" | "CREDIT";
  amount: number;
  currency: string;
  status: LedgerEntryStatus;
  createdAt: string;
  settledAt: string | null;
}

export interface AccountBalance {
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  net: number;
}

export interface TrialBalance {
  accounts: AccountBalance[];
  overallNet: number;
}

export interface SettlementBatch {
  id: string;
  filename: string;
  uploadedAt: string;
  status: SettlementBatchStatus;
  totalRecords: number;
  matchedCount: number;
  mismatchedCount: number;
  unmatchedCount: number;
}

export interface SettlementRecord {
  id: string;
  gatewayEventId: string;
  amount: number;
  currency: string;
  settledAt: string;
  matchStatus: SettlementMatchStatus;
  paymentEventId: string | null;
}

export interface SettlementBatchDetail extends SettlementBatch {
  records: SettlementRecord[];
}
