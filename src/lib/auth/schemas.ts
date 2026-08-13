import { z } from "zod";

import { BUSINESS_ACTIVITIES, isSelectableActivityId } from "@/lib/auth/activities";
import { isValidSlug } from "@/lib/auth/slugs";

const emailSchema = z
  .string()
  .trim()
  .min(1, "L'adresse e-mail est obligatoire.")
  .email("Adresse e-mail invalide.");

const passwordSchema = z
  .string()
  .min(10, "Le mot de passe doit contenir au moins 10 caractères.");

export const signUpSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Le nom complet est obligatoire."),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "La confirmation est obligatoire."),
    acceptTerms: z.literal(true, {
      error: "Vous devez accepter les conditions d'utilisation.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "L'identifiant ou l'e-mail est obligatoire."),
  password: z.string().min(1, "Le mot de passe est obligatoire."),
});

export const resetPasswordRequestSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "La confirmation est obligatoire."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export const establishmentTypeSchema = z.enum([
  "RESTAURANT_MAQUIS",
  "RESTAURANT",
  "MAQUIS",
  "BAR",
  "COMMERCE",
]);

export const activityCodeSchema = z
  .enum(
    BUSINESS_ACTIVITIES.map((item) => item.id) as [
      (typeof BUSINESS_ACTIVITIES)[number]["id"],
      ...(typeof BUSINESS_ACTIVITIES)[number]["id"][],
    ],
  )
  .refine(isSelectableActivityId, "Cette activité n’est pas encore disponible.");

export const onboardingSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Le nom commercial est obligatoire."),
  organizationSlug: z
    .string()
    .trim()
    .min(1, "Le slug de l'organisation est obligatoire.")
    .refine(isValidSlug, "Le slug de l'organisation est invalide."),
  phone: z.string().trim().optional(),
  establishmentName: z
    .string()
    .trim()
    .min(2, "Le nom de l'établissement est obligatoire."),
  establishmentSlug: z
    .string()
    .trim()
    .min(1, "Le slug de l'établissement est obligatoire.")
    .refine(isValidSlug, "Le slug de l'établissement est invalide."),
  activityCode: activityCodeSchema,
  establishmentType: establishmentTypeSchema.optional(),
  address: z
    .string()
    .trim()
    .min(2, "Le quartier est obligatoire."),
  city: z.string().trim().min(2, "La ville est obligatoire."),
  country: z.string().trim().default("Burkina Faso"),
  currency: z.string().trim().default("XOF"),
  timezone: z.string().trim().default("Africa/Ouagadougou"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type EstablishmentType = z.infer<typeof establishmentTypeSchema>;
