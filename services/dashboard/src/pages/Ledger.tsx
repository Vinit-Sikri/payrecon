import { useState } from "react";
import { useLedgerEntries } from "../api/hooks";
import { StatusPill } from "../components/StatusPill";
import { formatMinorUnits } from "../lib/money";

export function Ledger() {
  const [status, setStatus] = useState<string>("");
  const entries = useLedgerEntries(status || undefined, 50);

  return (
    <div>
      <h2>Ledger entries</h2>

      <div className="form-row">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="PENDING_SETTLEMENT">Pending settlement</option>
          <option value="SETTLED">Settled</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th>Direction</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Payment event</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {entries.data?.entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.accountType}</td>
              <td>{entry.direction}</td>
              <td>{formatMinorUnits(entry.amount, entry.currency)}</td>
              <td>
                <StatusPill status={entry.status} />
              </td>
              <td className="mono">{entry.paymentEventId.slice(0, 8)}</td>
              <td className="muted">{new Date(entry.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
