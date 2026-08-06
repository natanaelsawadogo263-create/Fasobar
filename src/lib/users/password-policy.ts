import { z } from "zod";

const uppercasePattern = /[A-Z]/;
const lowercasePattern = /[a-z]/;
const digitPattern = /[0-9]/;
const specialPattern = /[^A-Za-z0-9]/;

export function scorePasswordStrength(password: string): number {
  let score = 0;

  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (uppercasePattern.test(password)) score += 1;
  if (lowercasePattern.test(password)) score += 1;
  if (digitPattern.test(password)) score += 1;
  if (specialPattern.test(password)) score += 1;

  return Math.min(score, 5);
}

export function passwordStrengthLabel(score: number): string {
  if (score <= 2) return "Faible";
  if (score <= 4) return "Correct";
  return "Fort";
}

export function passwordPolicyRefinement(password: string, ctx: z.RefinementCtx): void {
  if (password.length < 10) {
    ctx.addIssue({
      code: "custom",
      message: "Le mot de passe doit contenir au moins 10 caractères.",
    });
  }

  if (!uppercasePattern.test(password)) {
    ctx.addIssue({
      code: "custom",
      message: "Le mot de passe doit contenir au moins une majuscule.",
    });
  }

  if (!lowercasePattern.test(password)) {
    ctx.addIssue({
      code: "custom",
      message: "Le mot de passe doit contenir au moins une minuscule.",
    });
  }

  if (!digitPattern.test(password)) {
    ctx.addIssue({
      code: "custom",
      message: "Le mot de passe doit contenir au moins un chiffre.",
    });
  }

  if (!specialPattern.test(password)) {
    ctx.addIssue({
      code: "custom",
      message: "Le mot de passe doit contenir au moins un caractère spécial.",
    });
  }
}

import { DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD } from "@/lib/users/constants";

export const securePasswordSchema = z
  .string()
  .superRefine((value, ctx) => passwordPolicyRefinement(value, ctx));

export const temporaryPasswordSchema = securePasswordSchema;

export const firstLoginPasswordSchema = z
  .object({
    password: securePasswordSchema,
    confirmPassword: z.string().min(1, "La confirmation est obligatoire."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD, {
    message: "Le mot de passe personnel doit être différent du mot de passe temporaire FasoBar.",
    path: ["password"],
  });

export const createEmployeePasswordSchema = z
  .object({
    temporaryPassword: temporaryPasswordSchema,
    temporaryPasswordConfirmation: z.string().min(1, "La confirmation est obligatoire."),
  })
  .refine((data) => data.temporaryPassword === data.temporaryPasswordConfirmation, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["temporaryPasswordConfirmation"],
  });

export const resetTemporaryPasswordSchema = z
  .object({
    userId: z.string().uuid("Utilisateur invalide."),
    temporaryPassword: temporaryPasswordSchema,
    temporaryPasswordConfirmation: z.string().min(1, "La confirmation est obligatoire."),
    confirmed: z.coerce.boolean(),
  })
  .refine((data) => data.temporaryPassword === data.temporaryPasswordConfirmation, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["temporaryPasswordConfirmation"],
  });
