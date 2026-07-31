import { z } from "zod";

export const listLedgerEntriesQuerySchema = z.object({
  status: z.enum(["PENDING_SETTLEMENT", "SETTLED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListLedgerEntriesQuery = z.infer<typeof listLedgerEntriesQuerySchema>;
