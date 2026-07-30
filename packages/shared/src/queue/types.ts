/**
 * The stream carries a reference, not the full event payload — the worker
 * re-reads the PaymentEvent row from Postgres (the source of truth) rather
 * than trusting queue-carried business data, so messages stay tiny and can
 * never go stale relative to the DB.
 */
export interface PaymentEventStreamMessage {
  paymentEventId: string;
}
