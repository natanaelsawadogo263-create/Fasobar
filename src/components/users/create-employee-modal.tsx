"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { createEmployeeAccountAction } from "@/app/(protected)/application/utilisateurs/actions";
import { AlertMessage } from "@/components/auth/alert-message";
import { FormField, FormSelect } from "@/components/auth/form-field";
import { CredentialsSuccessModal } from "@/components/users/credentials-success-modal";
import { suggestLoginIdentifierFromName } from "@/lib/auth/login-identifier";
import { getInvitableSpacesForActivity, isRetailActivity } from "@/lib/activity/profile";
import type { ServiceScope } from "@/lib/settings/service-scope";
import { DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD } from "@/lib/users/constants";
import type { CreatedCredentialsSummary } from "@/lib/users/types";
import { ModalShell } from "@/components/ui/modal-shell";

type CreateEmployeeModalProps = {
  establishments: Array<{ id: string; name: string }>;
  defaultEstablishmentId: string;
  onClose: () => void;
  onCreated: () => void;
  serviceScope?: ServiceScope;
  activityCode?: string | null;
};

const emptyForm = {
  fullName: "",
  loginIdentifier: "",
  phone: "",
  space: "cashier_kitchen",
  establishmentId: "",
};

export function CreateEmployeeModal({
  establishments,
  defaultEstablishmentId,
  onClose,
  onCreated,
  serviceScope = "BOTH",
  activityCode = null,
}: CreateEmployeeModalProps) {
  const [form, setForm] = useState({
    ...emptyForm,
    establishmentId: defaultEstablishmentId,
  });
  const [loginTouched, setLoginTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<CreatedCredentialsSummary | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const availableSpaces = getInvitableSpacesForActivity(activityCode, serviceScope);
  const idempotencyKey = useMemo(
    () => (typeof crypto !== "undefined" ? crypto.randomUUID() : ""),
    [],
  );
  const submittedRef = useRef(false);

  useEffect(() => {
    submittedRef.current = false;
  }, []);

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "fullName" && !loginTouched) {
        next.loginIdentifier = suggestLoginIdentifierFromName(String(value));
      }
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittedRef.current || isPending) {
      return;
    }

    submittedRef.current = true;
    setError(null);

    const selectedEstablishment =
      establishments.find((item) => item.id === form.establishmentId) ??
      establishments[0];
    const selectedSpace = availableSpaces.find((item) => item.id === form.space);

    const formData = new FormData();
    formData.set("fullName", form.fullName);
    formData.set("loginIdentifier", form.loginIdentifier);
    formData.set("phone", form.phone);
    formData.set("space", form.space);
    formData.set("establishmentId", form.establishmentId);
    formData.set("idempotencyKey", idempotencyKey);

    startTransition(async () => {
      const result = await createEmployeeAccountAction({}, formData);

      if (result.error) {
        setError(result.error);
        submittedRef.current = false;
        return;
      }

      setSuccessSummary({
        fullName: form.fullName,
        loginIdentifier:
          result.loginIdentifier ?? form.loginIdentifier.trim().toLowerCase(),
        spaceLabel: selectedSpace?.label ?? "—",
        establishmentName: selectedEstablishment?.name ?? "—",
        temporaryPassword: DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD,
      });

      setForm({ ...emptyForm, establishmentId: defaultEstablishmentId });
      setLoginTouched(false);
      onCreated();
    });
  }

  if (successSummary) {
    return (
      <CredentialsSuccessModal
        summary={successSummary}
        retail={isRetailActivity(activityCode)}
        onClose={() => {
          setSuccessSummary(null);
          onClose();
        }}
      />
    );
  }

  return (
    <ModalShell
      formId="create-employee-form"
      title="Créer un compte employé"
      subtitle="FasoBar attribue un identifiant personnel (pas un e-mail) et un mot de passe temporaire. Chaque employé n’accède qu’à son espace de travail."
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="create-employee-form"
            disabled={isPending}
            aria-busy={isPending}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Création..." : "Créer le compte"}
          </button>
        </div>
      }
    >
      {error ? <AlertMessage message={error} /> : null}

      <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-slate-700">
        Mot de passe temporaire automatique :{" "}
        <span className="font-mono font-medium text-slate-900">
          {DEFAULT_TEMPORARY_EMPLOYEE_PASSWORD}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="fullName"
          name="fullName"
          label="Nom complet"
          autoComplete="name"
          required
          value={form.fullName}
          onChange={(event) => updateField("fullName", event.target.value)}
        />

        <FormField
          id="loginIdentifier"
          name="loginIdentifier"
          label="Identifiant FasoBar"
          type="text"
          autoComplete="username"
          required
          value={form.loginIdentifier}
          onChange={(event) => {
            setLoginTouched(true);
            updateField("loginIdentifier", event.target.value);
          }}
        />

        <FormField
          id="phone"
          name="phone"
          label="Téléphone"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(event) => updateField("phone", event.target.value)}
        />

        <FormSelect
          id="establishmentId"
          name="establishmentId"
          label="Établissement"
          required
          value={form.establishmentId}
          onChange={(event) => updateField("establishmentId", event.target.value)}
        >
          {establishments.map((establishment) => (
            <option key={establishment.id} value={establishment.id}>
              {establishment.name}
            </option>
          ))}
        </FormSelect>
      </div>

      <fieldset className="mt-6 space-y-3">
        <legend className="text-sm font-medium text-slate-900">Espace attribué</legend>
        {availableSpaces.map((space) => (
          <label
            key={space.id}
            className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-200 has-checked:border-emerald-300 has-checked:bg-emerald-50/50"
          >
            <input
              type="radio"
              name="space"
              value={space.id}
              checked={form.space === space.id}
              onChange={() => updateField("space", space.id)}
              className="mt-1 h-4 w-4 accent-emerald-700"
            />
            <span>
              <span className="block text-sm font-medium text-slate-900">{space.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{space.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </ModalShell>
  );
}
