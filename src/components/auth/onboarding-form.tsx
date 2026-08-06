"use client";

import { useActionState, useState } from "react";

import { bootstrapOrganizationAction } from "@/app/(protected)/onboarding/actions";
import { ESTABLISHMENT_TYPE_LABELS, ESTABLISHMENT_TYPES } from "@/lib/auth/constants";
import type { AuthActionState } from "@/lib/auth/types";
import { slugifyFromName } from "@/lib/auth/slugs";
import { AlertMessage } from "@/components/auth/alert-message";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField, FormSelect } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: AuthActionState = {};

export function OnboardingForm() {
  const [state, formAction] = useActionState(bootstrapOrganizationAction, initialState);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [establishmentName, setEstablishmentName] = useState("");
  const [establishmentSlug, setEstablishmentSlug] = useState("");
  const [organizationSlugEdited, setOrganizationSlugEdited] = useState(false);
  const [establishmentSlugEdited, setEstablishmentSlugEdited] = useState(false);

  const organizationSlugValue = organizationSlugEdited
    ? organizationSlug
    : slugifyFromName(organizationName);

  const establishmentSlugValue = establishmentSlugEdited
    ? establishmentSlug
    : slugifyFromName(establishmentName);

  return (
    <AuthCard
      title="Configuration initiale"
      description="Créez votre organisation et votre premier établissement."
    >
      <form action={formAction} className="space-y-8">
        {state.error ? <AlertMessage message={state.error} /> : null}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Organisation</h2>

          <FormField
            id="organizationName"
            name="organizationName"
            label="Nom commercial"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            required
          />

          <FormField
            id="organizationSlug"
            name="organizationSlug"
            label="Slug organisation"
            value={organizationSlugValue}
            onChange={(event) => {
              setOrganizationSlugEdited(true);
              setOrganizationSlug(event.target.value);
            }}
            hint="Utilisé dans les URLs internes. Lettres minuscules, chiffres et tirets."
            required
          />

          <FormField
            id="phone"
            name="phone"
            label="Téléphone"
            type="tel"
            autoComplete="tel"
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Premier établissement</h2>

          <FormField
            id="establishmentName"
            name="establishmentName"
            label="Nom de l'établissement"
            value={establishmentName}
            onChange={(event) => setEstablishmentName(event.target.value)}
            required
          />

          <FormField
            id="establishmentSlug"
            name="establishmentSlug"
            label="Slug établissement"
            value={establishmentSlugValue}
            onChange={(event) => {
              setEstablishmentSlugEdited(true);
              setEstablishmentSlug(event.target.value);
            }}
            required
          />

          <FormSelect id="establishmentType" name="establishmentType" label="Type" required defaultValue="RESTAURANT_MAQUIS">
            {ESTABLISHMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ESTABLISHMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </FormSelect>

          <FormField id="address" name="address" label="Adresse" autoComplete="street-address" />

          <FormField id="city" name="city" label="Ville" required defaultValue="" />

          <input type="hidden" name="country" value="Burkina Faso" />
          <input type="hidden" name="currency" value="XOF" />
          <input type="hidden" name="timezone" value="Africa/Ouagadougou" />
        </section>

        <SubmitButton label="Finaliser la configuration" pendingLabel="Création..." />
      </form>
    </AuthCard>
  );
}
