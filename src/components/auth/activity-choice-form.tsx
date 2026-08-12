"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { saveActivityChoiceAction } from "@/app/(auth)/inscription/activite/actions";
import { ActivityPicker } from "@/components/auth/activity-picker";
import { SubmitButton } from "@/components/auth/submit-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";
import type { BusinessActivityId } from "@/lib/auth/activities";

type ActivityChoiceFormProps = {
  initialActivity?: BusinessActivityId | "";
};

export function ActivityChoiceForm({
  initialActivity = "",
}: ActivityChoiceFormProps) {
  const [activity, setActivity] = useState<BusinessActivityId | "">(
    initialActivity,
  );

  return (
    <div className="w-full max-w-3xl">
      <div className="text-center">
        <Link
          href="/connexion"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>
        <div className="mt-6 flex justify-center">
          <FasoBarLogo size="xl" markOnly />
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
          Étape 1 sur 3
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
          Quel type de commerce gérez-vous ?
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-[14px] leading-relaxed text-slate-500">
          Choisissez votre activité principale pour que FasoBar adapte votre
          espace.
        </p>
      </div>

      <form action={saveActivityChoiceAction} className="mt-8">
        <ActivityPicker value={activity} onChange={setActivity} />
        <div className="mt-6">
          <SubmitButton
            label="Continuer"
            pendingLabel="Enregistrement..."
            disabled={!activity}
          />
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="font-medium text-emerald-700 hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
