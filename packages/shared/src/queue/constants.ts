/** Redis Streams key carrying newly-ingested payment events for reconciliation. */
export const PAYMENT_EVENTS_STREAM = "payrecon:payment-events";

/** Consumer group all reconciliation-worker replicas share, so each stream entry is processed exactly once across the fleet. */
export const RECONCILIATION_CONSUMER_GROUP = "reconciliation-workers";
