import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentStatus } from "@payrecon/shared";
import { decideOutcome } from "./outcome.service";

describe("decideOutcome", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const rates = { FAILURE_RATE: 0.2, PENDING_RATE: 0.1 };

  it("returns FAILED when the roll lands in the failure band", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1); // < 0.2
    expect(decideOutcome(rates)).toBe(PaymentStatus.FAILED);
  });

  it("returns PENDING when the roll lands in the pending band", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25); // >= 0.2, < 0.3
    expect(decideOutcome(rates)).toBe(PaymentStatus.PENDING);
  });

  it("returns SUCCESS when the roll lands outside both bands", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9); // >= 0.3
    expect(decideOutcome(rates)).toBe(PaymentStatus.SUCCESS);
  });

  it("treats the failure/pending boundary as exclusive-inclusive (roll === failureRate is not a failure)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2); // === FAILURE_RATE
    expect(decideOutcome(rates)).toBe(PaymentStatus.PENDING);
  });
});
