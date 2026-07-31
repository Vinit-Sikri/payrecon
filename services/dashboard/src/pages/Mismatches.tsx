import { useMismatches } from "../api/hooks";
import { formatMinorUnits } from "../lib/money";

export function Mismatches() {
  const mismatches = useMismatches(50);

  return (
    <div>
      <h2>Mismatches</h2>
      <table>
        <thead>
          <tr>
            <th>Reason</th>
            <th>Payment event</th>
            <th>Amount</th>
            <th>Order</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {mismatches.data?.mismatches.map((m) => (
            <tr key={m.id}>
              <td>{m.reason}</td>
              <td className="mono">{m.paymentEvent.gatewayEventId.slice(0, 12)}</td>
              <td>{formatMinorUnits(m.paymentEvent.amount, m.paymentEvent.currency)}</td>
              <td className="mono">{m.paymentEvent.orderId ? m.paymentEvent.orderId.slice(0, 8) : "—"}</td>
              <td className="muted">{new Date(m.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {mismatches.data?.mismatches.length === 0 ? <p className="muted">No mismatches — clean reconciliation run.</p> : null}
    </div>
  );
}
