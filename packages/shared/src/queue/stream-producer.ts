import type { RedisClient } from "../redis/client";
import { PAYMENT_EVENTS_STREAM } from "./constants";
import type { PaymentEventStreamMessage } from "./types";

/**
 * Thin wrapper around XADD. Kept deliberately dumb (no retry/backoff logic)
 * because the ingestion webhook handler must respond fast (ack pattern) —
 * if this call fails, the whole webhook request fails and the gateway's own
 * retry mechanism redelivers, which is a simpler failure mode than trying to
 * buffer/retry the publish in-process.
 */
export class StreamProducer {
  constructor(private readonly redis: RedisClient) {}

  async publish(message: PaymentEventStreamMessage): Promise<string | null> {
    return this.redis.xadd(PAYMENT_EVENTS_STREAM, "*", "data", JSON.stringify(message));
  }
}
