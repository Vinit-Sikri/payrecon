import { z } from "zod";

export const recentMismatchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type RecentMismatchesQuery = z.infer<typeof recentMismatchesQuerySchema>;
