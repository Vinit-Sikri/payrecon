import { useRef, useState } from "react";
import { useSettlementBatch, useSettlementBatches, useUploadSettlement } from "../api/hooks";
import { StatusPill } from "../components/StatusPill";
import { formatMinorUnits } from "../lib/money";

export function Settlements() {
  const batches = useSettlementBatches(50);
  const upload = useUploadSettlement();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useSettlementBatch(selectedId);

  function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      upload.mutate(file, { onSuccess: (batch) => setSelectedId(batch.id) });
    }
  }

  return (
    <div>
      <h2>Settlements</h2>

      <div className="card">
        <h3>Upload a bank settlement file (CSV)</h3>
        <form className="form-row" onSubmit={handleUpload}>
          <input ref={fileInputRef} type="file" accept=".csv" />
          <button type="submit" disabled={upload.isPending}>
            {upload.isPending ? "Uploading…" : "Upload"}
          </button>
        </form>
        {upload.isError ? <p className="muted status-critical">{(upload.error as Error).message}</p> : null}
      </div>

      <table style={{ marginBottom: 24 }}>
        <thead>
          <tr>
            <th>File</th>
            <th>Status</th>
            <th>Records</th>
            <th>Matched</th>
            <th>Mismatched</th>
            <th>Unmatched</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {batches.data?.batches.map((batch) => (
            <tr key={batch.id} onClick={() => setSelectedId(batch.id)} style={{ cursor: "pointer" }}>
              <td>{batch.filename}</td>
              <td>
                <StatusPill status={batch.status} />
              </td>
              <td>{batch.totalRecords}</td>
              <td>{batch.matchedCount}</td>
              <td>{batch.mismatchedCount}</td>
              <td>{batch.unmatchedCount}</td>
              <td className="muted">{new Date(batch.uploadedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {detail.data ? (
        <div className="card">
          <h3>Batch detail — {detail.data.filename}</h3>
          <table>
            <thead>
              <tr>
                <th>Gateway event</th>
                <th>Amount</th>
                <th>Settled at</th>
                <th>Match status</th>
              </tr>
            </thead>
            <tbody>
              {detail.data.records.map((record) => (
                <tr key={record.id}>
                  <td className="mono">{record.gatewayEventId.slice(0, 16)}</td>
                  <td>{formatMinorUnits(record.amount, record.currency)}</td>
                  <td className="muted">{new Date(record.settledAt).toLocaleString()}</td>
                  <td>
                    <StatusPill status={record.matchStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
