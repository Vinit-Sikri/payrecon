import { useState } from "react";
import { useCreateOrder, useOrders, useTriggerPayment } from "../api/hooks";
import { StatusPill } from "../components/StatusPill";
import { formatMinorUnits } from "../lib/money";

export function Orders() {
  const orders = useOrders(50);
  const createOrder = useCreateOrder();
  const triggerPayment = useTriggerPayment();
  const [amount, setAmount] = useState("5000");
  const [currency, setCurrency] = useState("USD");

  function handleCreateOrder(event: React.FormEvent) {
    event.preventDefault();
    createOrder.mutate({ amount: Number(amount), currency });
  }

  return (
    <div>
      <h2>Orders</h2>

      <div className="card">
        <h3>Create an order</h3>
        <form className="form-row" onSubmit={handleCreateOrder}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (minor units)"
            min={1}
          />
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} style={{ width: 60 }} />
          <button type="submit" disabled={createOrder.isPending}>
            {createOrder.isPending ? "Creating…" : "Create order"}
          </button>
        </form>
      </div>

      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.data?.orders.map((order) => (
            <tr key={order.id}>
              <td className="mono">{order.id.slice(0, 8)}</td>
              <td>{formatMinorUnits(order.amount, order.currency)}</td>
              <td>
                <StatusPill status={order.status} />
              </td>
              <td className="muted">{new Date(order.createdAt).toLocaleString()}</td>
              <td>
                {order.status === "CREATED" ? (
                  <button
                    className="secondary"
                    disabled={triggerPayment.isPending}
                    onClick={() => triggerPayment.mutate({ orderId: order.id, amount: order.amount, currency: order.currency })}
                  >
                    Trigger payment
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
