import { describe, expect, it } from "vitest";
import { LedgerAccountType, LedgerDirection, OrderStatus } from "@payrecon/shared";
import { createLedgerEntries } from "./ledger.service";

describe("createLedgerEntries", () => {
  it("books a balanced debit/credit pair for a PAID order", () => {
    const drafts = createLedgerEntries({ amount: 5000, currency: "USD", orderStatusUpdate: OrderStatus.PAID });

    expect(drafts).toEqual([
      { accountType: LedgerAccountType.GATEWAY_RECEIVABLE, direction: LedgerDirection.DEBIT, amount: 5000, currency: "USD" },
      { accountType: LedgerAccountType.MERCHANT_PAYABLE, direction: LedgerDirection.CREDIT, amount: 5000, currency: "USD" },
    ]);
  });

  it("books a balanced debit/credit pair for a REFUNDED order", () => {
    const drafts = createLedgerEntries({ amount: 1200, currency: "EUR", orderStatusUpdate: OrderStatus.REFUNDED });

    expect(drafts).toEqual([
      { accountType: LedgerAccountType.GATEWAY_RECEIVABLE, direction: LedgerDirection.DEBIT, amount: 1200, currency: "EUR" },
      { accountType: LedgerAccountType.MERCHANT_PAYABLE, direction: LedgerDirection.CREDIT, amount: 1200, currency: "EUR" },
    ]);
  });

  it("books nothing for statuses that never touch money (defensive)", () => {
    expect(createLedgerEntries({ amount: 5000, currency: "USD", orderStatusUpdate: OrderStatus.CREATED })).toEqual([]);
    expect(createLedgerEntries({ amount: 5000, currency: "USD", orderStatusUpdate: OrderStatus.CANCELLED })).toEqual([]);
  });

  it("always produces entries that net to zero (debit amount equals credit amount)", () => {
    const drafts = createLedgerEntries({ amount: 999, currency: "USD", orderStatusUpdate: OrderStatus.PAID });

    const debitTotal = drafts.filter((d) => d.direction === LedgerDirection.DEBIT).reduce((sum, d) => sum + d.amount, 0);
    const creditTotal = drafts.filter((d) => d.direction === LedgerDirection.CREDIT).reduce((sum, d) => sum + d.amount, 0);

    expect(debitTotal).toBe(creditTotal);
  });
});
