"use client";

import { useActionState, useState } from "react";

import { bootstrapOrganizationAction } from "@/app/(protected)/onboarding/actions";
import { ActivityPicker } from "@/components/auth/activity-picker";
import { AlertMessage } from "@/components/auth/alert-message";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import {
  getBusinessActivity,
  type BusinessActivityId,
} from "@/lib/auth/activities";
import type { AuthActionState } from "@/lib/auth/types";
import { slugifyFromName } from "@/lib/auth/slugs";

const initialState: AuthActionState = {};

type OnboardingFormProps = {
  initialActivity?: BusinessActivityId | "";
};

export function OnboardingForm({ initialActivity = "" }: OnboardingFormProps) {
  const [state, formAction] = useActionState(bootstrapOrganizationAction, initialState);
  const [activityCode, setActivityCode] = useState<BusinessActivityId | "">(
    initialActivity,
  );
  const [organizationName, setOrganizationName] = useState("");
  const [establishmentName, setEstablishmentName] = useState("");
  const [establishmentTouched, setEstablishmentTouched] = useState(false);
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [quartier, setQuartier] = useState("");

  const organizationSlug = slugifyFromName(organizationName);
  const resolvedEstablishmentName = establishmentTouched
    ? establishmentName
    : organizationName;
  const establishmentSlug = slugifyFromName(resolvedEstablishmentName);
  const selectedActivity = getBusinessActivity(activityCode);

  if (!activityCode) {
    return (
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <div className="flex justify-center">
            <FasoBarLogo size="md" />
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Étape 3 sur 3
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Quel type de commerce gérez-vous ?
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
            Choisissez votre activité principale pour que FasoBar adapte votre
            espace.
          </p>
        </div>
        <div className="mt-8">
          <ActivityPicker value="" onChange={setActivityCode} />
        </div>
      </div>
    );
  }

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
                Étape 3 sur 3
              </p>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                Informations de l&apos;établissement
              </h1>
              <p className="mx-auto mt-2 max-w-[22rem] text-sm leading-relaxed text-slate-500">
                Indiquez le nom, la ville et le quartier de votre établissement.
              </p>
            </header>

            {state.error ? (
              <div className="mt-6">
                <AlertMessage message={state.error} />
              </div>
            ) : null}

            <input type="hidden" name="organizationSlug" value={organizationSlug} />
            <input type="hidden" name="establishmentSlug" value={establishmentSlug} />
            <input type="hidden" name="activityCode" value={activityCode} />
            <input type="hidden" name="country" value="Burkina Faso" />
            <input type="hidden" name="currency" value="XOF" />
            <input type="hidden" name="timezone" value="Africa/Ouagadougou" />

            <div className="mt-8 space-y-6">
              <section className="space-y-3.5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Votre établissement
                </h2>

                <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                      Activité
                    </p>
                    <p className="mt-0.5 text-[13px] font-medium text-slate-900">
                      {selectedActivity?.label}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivityCode("")}
                    className="text-[12px] font-semibold text-emerald-800 hover:underline"
                  >
                    Modifier
                  </button>
                </div>

                <FormField
                  id="organizationName"
                  name="organizationName"
                  label="Nom commercial"
                  placeholder="Ex. Boutique du Centre"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  required
                />

                <FormField
                  id="establishmentName"
                  name="establishmentName"
                  label="Nom de l'établissement"
                  placeholder="Ex. Boutique du Centre — Ouaga 2000"
                  value={resolvedEstablishmentName}
                  onChange={(event) => {
                    setEstablishmentTouched(true);
                    setEstablishmentName(event.target.value);
                  }}
                  required
                />

                <FormField
                  id="phone"
                  name="phone"
                  label="Téléphone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+226 70 00 00 00"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </section>

              <div className="h-px bg-slate-100" aria-hidden />

              <section className="space-y-3.5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Localisation
                </h2>

                <FormField
                  id="city"
                  name="city"
                  label="Ville"
                  required
                  placeholder="Ex. Ouagadougou"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />

                <FormField
                  id="address"
                  name="address"
                  label="Quartier"
                  required
                  placeholder="Ex. Ouaga 2000, Zone 1, Dassasgho…"
                  value={quartier}
                  onChange={(event) => setQuartier(event.target.value)}
                />
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
