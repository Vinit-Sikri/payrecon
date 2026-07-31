/**
 * Dev-only utility: generates a demo bank settlement CSV from real
 * PaymentEvents already sitting in Postgres, so Phase B (settlement upload)
 * is demoable without hand-authoring a CSV. Deliberately perturbs a couple
 * of rows so all three SettlementMatchStatus outcomes (MATCHED,
 * AMOUNT_MISMATCH, UNMATCHED) show up in one generated file.
 *
 * Usage: npm run settlement:demo-csv --workspace=@payrecon/db > settlement.csv
 */
import { randomUUID } from "node:crypto";
import { prisma, disconnectPrisma } from "../src";

async function main(): Promise<void> {
  const events = await prisma.paymentEvent.findMany({
    where: { gatewayStatus: "SUCCESS" },
    orderBy: { receivedAt: "desc" },
    take: 20,
  });

  const rows: Array<{ gatewayEventId: string; amount: number; currency: string; settledAt: string }> = [];

  events.forEach((event, index) => {
    // Perturb the second row's amount to manufacture a demoable
    // AMOUNT_MISMATCH — the bank says a different amount settled than the
    // webhook reported.
    const amount = index === 1 ? event.amount + 100 : event.amount;
    rows.push({
      gatewayEventId: event.gatewayEventId,
      amount,
      currency: event.currency,
      settledAt: new Date().toISOString(),
    });
  });

  // Manufacture a demoable UNMATCHED row — money the bank says settled that
  // we have no corresponding webhook for at all.
  rows.push({
    gatewayEventId: `unmatched-${randomUUID()}`,
    amount: 999,
    currency: "USD",
    settledAt: new Date().toISOString(),
  });

  const header = "gatewayEventId,amount,currency,settledAt";
  const body = rows.map((r) => `${r.gatewayEventId},${r.amount},${r.currency},${r.settledAt}`).join("\n");

  process.stdout.write(`${header}\n${body}\n`);

  await disconnectPrisma();
}

void main();
