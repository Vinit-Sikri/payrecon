import { z } from "zod";

/** ISO 4217 three-letter currency code, upper-cased. */
export const currencySchema = z
  .string()
  .length(3)
  .transform((val) => val.toUpperCase());

export const createOrderSchema = z.object({
  amount: z.number().int().positive("amount must be a positive integer (minor units, e.g. cents)"),
  currency: currencySchema,
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const orderIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type OrderIdParam = z.infer<typeof orderIdParamSchema>;

export const listOrdersQuerySchema = z.object({
  status: z.enum(["CREATED", "PAID", "CANCELLED", "REFUNDED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
