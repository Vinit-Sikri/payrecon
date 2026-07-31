import { useStatsSummary, useTrialBalance } from "../api/hooks";
import { StatTile } from "../components/StatTile";
import { formatMinorUnits } from "../lib/money";

const STATE_ORDER = ["PENDING", "MATCHED", "MISMATCHED", "FAILED", "DEAD_LETTERED"] as const;

export function Overview() {
  const stats = useStatsSummary();
  const balance = useTrialBalance();

  return (
    <div>
      <h2>Overview</h2>

      <div className="kpi-row">
        {stats.data
          ? STATE_ORDER.map((state) => <StatTile key={state} label={state} value={stats.data.counts[state]} />)
          : null}
      </div>

      <div className="card">
        <h3>Trial balance — the ledger books should always net to zero</h3>
        {balance.data ? (
          <>
            <div className="kpi-row">
              {balance.data.accounts.map((account) => (
                <div className="stat-tile" key={account.accountType}>
                  <div className="value">{formatMinorUnits(Math.abs(account.net), "USD")}</div>
                  <div className="label">
                    {account.accountType} ({account.net >= 0 ? "debit" : "credit"})
                  </div>
                </div>
              ))}
            </div>
            <div className={`balance-figure ${balance.data.overallNet === 0 ? "status-good" : "status-critical"}`}>
              {balance.data.overallNet === 0 ? "✓ Balanced" : `✗ Off by ${formatMinorUnits(balance.data.overallNet, "USD")}`}
            </div>
          </>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>
    </div>
  );
}
