import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiUpload, gatewayPost } from "./client";
import type {
  LedgerEntry,
  Mismatch,
  Order,
  ReconciliationSummary,
  SettlementBatch,
  SettlementBatchDetail,
  TrialBalance,
} from "./types";

/** Reconciliation has multi-second inherent latency (mock-gateway's simulated
 * delay, retry backoff) — a 3s poll keeps the dashboard "live" without adding
 * push infrastructure (SSE/WebSockets) for a benefit that wouldn't be visible. */
const POLL_INTERVAL_MS = 3000;

export function useStatsSummary() {
  return useQuery({
    queryKey: ["stats", "summary"],
    queryFn: () => apiGet<ReconciliationSummary>("/stats"),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useMismatches(limit = 20) {
  return useQuery({
    queryKey: ["stats", "mismatches", limit],
    queryFn: () => apiGet<{ mismatches: Mismatch[] }>(`/stats/mismatches?limit=${limit}`),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useTrialBalance() {
  return useQuery({
    queryKey: ["ledger", "balance"],
    queryFn: () => apiGet<TrialBalance>("/ledger/balance"),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useLedgerEntries(status?: string, limit = 20) {
  return useQuery({
    queryKey: ["ledger", "entries", status, limit],
    queryFn: () => {
      const query = new URLSearchParams({ limit: String(limit) });
      if (status) query.set("status", status);
      return apiGet<{ entries: LedgerEntry[] }>(`/ledger?${query.toString()}`);
    },
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useOrders(limit = 20) {
  return useQuery({
    queryKey: ["orders", limit],
    queryFn: () => apiGet<{ orders: Order[] }>(`/orders?limit=${limit}`),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount: number; currency: string }) => apiPost<Order>("/orders", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useTriggerPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: string; amount: number; currency: string }) =>
      gatewayPost<{ gatewayPaymentId: string; status: string }>("/payments", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useSettlementBatches(limit = 20) {
  return useQuery({
    queryKey: ["settlements", limit],
    queryFn: () => apiGet<{ batches: SettlementBatch[] }>(`/settlements?limit=${limit}`),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useSettlementBatch(id: string | null) {
  return useQuery({
    queryKey: ["settlements", "detail", id],
    queryFn: () => apiGet<SettlementBatchDetail>(`/settlements/${id}`),
    enabled: id !== null,
  });
}

export function useUploadSettlement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => apiUpload<SettlementBatch>("/settlements", file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settlements"] });
      void queryClient.invalidateQueries({ queryKey: ["ledger"] });
    },
  });
}
