import { z } from "zod";

export const salesFiltersSchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  cashierId: z.string().uuid().optional().or(z.literal("")),
});

export type SalesFiltersInput = z.infer<typeof salesFiltersSchema>;
