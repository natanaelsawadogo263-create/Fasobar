"use client";

import { useActionState, useState } from "react";

import { bootstrapOrganizationAction } from "@/app/(protected)/onboarding/actions";
import { ESTABLISHMENT_TYPE_LABELS, ESTABLISHMENT_TYPES } from "@/lib/auth/constants";
import type { AuthActionState } from "@/lib/auth/types";
import { slugifyFromName } from "@/lib/auth/slugs";
import { AlertMessage } from "@/components/auth/alert-message";
import { FormField, FormSelect } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";

const initialState: AuthActionState = {};

export function OnboardingForm() {
  const [state, formAction] = useActionState(bootstrapOrganizationAction, initialState);
  const [organizationName, setOrganizationName] = useState("");
  const [establishmentName, setEstablishmentName] = useState("");
  const [establishmentTouched, setEstablishmentTouched] = useState(false);

  const organizationSlug = slugifyFromName(organizationName);
  const resolvedEstablishmentName = establishmentTouched
    ? establishmentName
    : organizationName;
  const establishmentSlug = slugifyFromName(resolvedEstablishmentName);

  return (
    <div className="w-full max-w-[480px]">
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_20px_60px_-28px_rgba(15,23,42,0.28)]">
        <form action={formAction} className="flex flex-col">
          <div className="px-7 pb-2 pt-9 sm:px-9 sm:pt-10">
            <header className="text-center">
              <div className="flex justify-center">
                <FasoBarLogo size="md" />
              </div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Étape 2 sur 2
              </p>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                Informations de l&apos;établissement
              </h1>
              <p className="mx-auto mt-2 max-w-[22rem] text-sm leading-relaxed text-slate-500">
                Dernière étape : présentez votre activité et votre premier site.
              </p>
            </header>

            {state.error ? (
              <div className="mt-6">
                <AlertMessage message={state.error} />
              </div>
            ) : null}

            <input type="hidden" name="organizationSlug" value={organizationSlug} />
            <input type="hidden" name="establishmentSlug" value={establishmentSlug} />
            <input type="hidden" name="country" value="Burkina Faso" />
            <input type="hidden" name="currency" value="XOF" />
            <input type="hidden" name="timezone" value="Africa/Ouagadougou" />

            <div className="mt-8 space-y-6">
              <section className="space-y-3.5">
                <h2 className="text-sm font-semibold text-slate-900">Votre activité</h2>

                <FormField
                  id="organizationName"
                  name="organizationName"
                  label="Nom commercial"
                  placeholder="Ex. Maquis Le Palmier"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  required
                />

                <FormField
                  id="phone"
                  name="phone"
                  label="Téléphone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+226 70 00 00 00"
                />
              </section>

              <div className="h-px bg-slate-100" aria-hidden />

              <section className="space-y-3.5">
                <h2 className="text-sm font-semibold text-slate-900">Votre premier site</h2>

                <FormField
                  id="establishmentName"
                  name="establishmentName"
                  label="Nom du site"
                  placeholder="Identique au nom commercial, ou un nom de site"
                  value={resolvedEstablishmentName}
                  onChange={(event) => {
                    setEstablishmentTouched(true);
                    setEstablishmentName(event.target.value);
                  }}
                  required
                />

                <FormSelect
                  id="establishmentType"
                  name="establishmentType"
                  label="Type de site"
                  required
                  defaultValue="RESTAURANT_MAQUIS"
                >
                  {ESTABLISHMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ESTABLISHMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </FormSelect>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <FormField
                    id="city"
                    name="city"
                    label="Ville"
                    required
                    defaultValue=""
                    placeholder="Ouagadougou"
                  />

                  <FormField
                    id="address"
                    name="address"
                    label="Adresse"
                    autoComplete="street-address"
                    placeholder="Optionnel"
                  />
                </div>
              </section>
            </div>
          </div>

          <div className="sticky bottom-0 mt-6 border-t border-slate-100 bg-white px-7 py-4 sm:px-9">
            <SubmitButton label="Ouvrir mon espace" pendingLabel="Création..." />
          </div>
        </form>
      </div>
    </div>
  );
}
