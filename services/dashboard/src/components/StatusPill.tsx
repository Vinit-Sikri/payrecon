const STATUS_CLASS: Record<string, string> = {
  MATCHED: "status-good",
  SETTLED: "status-good",
  COMPLETED: "status-good",
  PAID: "status-good",
  PENDING: "status-warning",
  PENDING_SETTLEMENT: "status-warning",
  PROCESSING: "status-warning",
  CREATED: "status-warning",
  MISMATCHED: "status-serious",
  AMOUNT_MISMATCH: "status-serious",
  FAILED: "status-critical",
  DEAD_LETTERED: "status-critical",
  UNMATCHED: "status-critical",
};

export function StatusPill({ status }: { status: string }) {
  const className = STATUS_CLASS[status] ?? "status-warning";
  return (
    <span className={`status-pill ${className}`}>
      <span className="dot" aria-hidden="true" />
      {status}
    </span>
  );
}
