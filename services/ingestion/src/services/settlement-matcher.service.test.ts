import { describe, expect, it } from "vitest";
import { SettlementMatchStatus } from "@payrecon/shared";
import { matchSettlementRecord } from "./settlement-matcher.service";

describe("matchSettlementRecord", () => {
  it("returns UNMATCHED when no payment event is found for the settlement record", () => {
    const status = matchSettlementRecord({ amount: 5000, currency: "USD" }, null);
    expect(status).toBe(SettlementMatchStatus.UNMATCHED);
  });

  it("returns AMOUNT_MISMATCH when the amount disagrees", () => {
    const status = matchSettlementRecord({ amount: 4999, currency: "USD" }, { amount: 5000, currency: "USD" });
    expect(status).toBe(SettlementMatchStatus.AMOUNT_MISMATCH);
  });

  it("returns AMOUNT_MISMATCH when the currency disagrees (same reason category)", () => {
    const status = matchSettlementRecord({ amount: 5000, currency: "EUR" }, { amount: 5000, currency: "USD" });
    expect(status).toBe(SettlementMatchStatus.AMOUNT_MISMATCH);
  });

  it("returns MATCHED when amount and currency both agree", () => {
    const status = matchSettlementRecord({ amount: 5000, currency: "USD" }, { amount: 5000, currency: "USD" });
    expect(status).toBe(SettlementMatchStatus.MATCHED);
  });
});
