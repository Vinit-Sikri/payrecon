import { PaymentStatus } from "@payrecon/shared";

export interface OutcomeRates {
  FAILURE_RATE: number;
  PENDING_RATE: number;
}

/**
 * Rolls a single random outcome for a simulated payment. Order matters:
 * failure is checked first, then pending, so the two rates are independent
 * probabilities of their own band rather than needing to sum to <= 1 in a
 * particular way — anything left over is a success.
 */
export function decideOutcome(rates: OutcomeRates): PaymentStatus {
  const roll = Math.random();
  if (roll < rates.FAILURE_RATE) {
    return PaymentStatus.FAILED;
  }
  if (roll < rates.FAILURE_RATE + rates.PENDING_RATE) {
    return PaymentStatus.PENDING;
  }
  return PaymentStatus.SUCCESS;
}
