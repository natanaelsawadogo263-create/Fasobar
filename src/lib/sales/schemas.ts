import { z } from "zod";

export const salesPeriodSchema = z.enum(["day", "week", "month", "custom"]);

export const salesFiltersSchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  period: salesPeriodSchema.optional(),
  cashierId: z.string().uuid().optional().or(z.literal("")),
});

export type SalesFiltersInput = z.infer<typeof salesFiltersSchema>;
export type SalesPeriodFilter = z.infer<typeof salesPeriodSchema>;
