import { z } from "zod";

export const employeeSpaceSchema = z.enum(["admin", "cashier_kitchen", "bar_manager"]);

export const createEmployeeAccountSchema = z.object({
  fullName: z.string().trim().min(2, "Le nom complet est obligatoire."),
  email: z.string().trim().email("Adresse e-mail invalide."),
  phone: z.string().trim().optional(),
  space: employeeSpaceSchema,
  establishmentId: z.string().uuid("Établissement invalide."),
  idempotencyKey: z.string().uuid().optional(),
});

export const setMemberStatusSchema = z.object({
  userId: z.string().uuid("Utilisateur invalide."),
  active: z.coerce.boolean(),
  reason: z.string().trim().optional(),
  confirmed: z.coerce.boolean(),
});

export const deleteEmployeeAccountSchema = z.object({
  userId: z.string().uuid("Utilisateur invalide."),
  reason: z
    .string()
    .trim()
    .min(3, "Le motif de suppression est obligatoire."),
  confirmed: z.coerce.boolean(),
});

export type EmployeeSpace = z.infer<typeof employeeSpaceSchema>;
export type DeleteEmployeeAccountInput = z.infer<typeof deleteEmployeeAccountSchema>;
