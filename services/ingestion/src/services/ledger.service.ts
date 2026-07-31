import type { LedgerEntry } from "@payrecon/db";
import type { LedgerRepository, ListLedgerEntriesFilter } from "../repositories/ledger.repository";

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

export class LedgerService {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  listEntries(filter: ListLedgerEntriesFilter): Promise<LedgerEntry[]> {
    return this.ledgerRepository.list(filter);
  }

  async getBalance(): Promise<TrialBalance> {
    const rows = await this.ledgerRepository.aggregateBalance();

    const byAccount = new Map<string, AccountBalance>();
    for (const row of rows) {
      const entry = byAccount.get(row.accountType) ?? {
        accountType: row.accountType,
        totalDebit: 0,
        totalCredit: 0,
        net: 0,
      };

      if (row.direction === "DEBIT") {
        entry.totalDebit += row.total;
      } else {
        entry.totalCredit += row.total;
      }
      entry.net = entry.totalDebit - entry.totalCredit;

      byAccount.set(row.accountType, entry);
    }

    const accounts = Array.from(byAccount.values());
    const overallNet = accounts.reduce((sum, account) => sum + account.net, 0);

    return { accounts, overallNet };
  }
}
