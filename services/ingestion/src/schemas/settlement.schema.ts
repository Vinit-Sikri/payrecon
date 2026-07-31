import { z } from "zod";

export const settlementBatchIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type SettlementBatchIdParam = z.infer<typeof settlementBatchIdParamSchema>;

export const listSettlementBatchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListSettlementBatchesQuery = z.infer<typeof listSettlementBatchesQuerySchema>;
