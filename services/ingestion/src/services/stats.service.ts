import { ReconciliationState } from "@payrecon/shared";
import type { MismatchRepository, RecentMismatch } from "../repositories/mismatch.repository";
import type { PaymentEventRepository } from "../repositories/payment-event.repository";

export interface ReconciliationSummary {
  counts: Record<ReconciliationState, number>;
  total: number;
}

export class StatsService {
  constructor(
    private readonly paymentEventRepository: PaymentEventRepository,
    private readonly mismatchRepository: MismatchRepository,
  ) {}

  async getSummary(): Promise<ReconciliationSummary> {
    const rows = await this.paymentEventRepository.countByReconciliationState();

    const counts = Object.values(ReconciliationState).reduce(
      (acc, state) => {
        acc[state] = 0;
        return acc;
      },
      {} as Record<ReconciliationState, number>,
    );

    let total = 0;
    for (const row of rows) {
      const state = row.reconciliationState as ReconciliationState;
      counts[state] = row.count;
      total += row.count;
    }

    return { counts, total };
  }

  getRecentMismatches(limit: number): Promise<RecentMismatch[]> {
    return this.mismatchRepository.findRecent(limit);
  }
}
