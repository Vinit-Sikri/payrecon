import { z } from "zod";
import { currencySchema } from "@payrecon/shared";

export const simulatePaymentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().int().positive(),
  currency: currencySchema,
});
export type SimulatePaymentInput = z.infer<typeof simulatePaymentSchema>;
