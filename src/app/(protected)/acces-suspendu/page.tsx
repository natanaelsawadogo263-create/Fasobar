import { SignOutButton } from "@/components/auth/sign-out-button";
import { FasoBarLogo } from "@/components/brand/fasobar-logo";

export default function AccessSuspendedPage() {
  return (
    <div className="flex h-dvh items-center justify-center overflow-y-auto bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <FasoBarLogo size="md" />
        </div>
        <p className="mt-6 text-sm font-medium uppercase tracking-wide text-amber-700">
          Accès suspendu
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          Compte temporairement désactivé
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Contactez l&apos;administrateur de votre établissement pour réactiver
          votre accès. Votre historique reste conservé.
        </p>
        <div className="mt-8 flex justify-center">
          <SignOutButton label="Retour à la connexion" />
        </div>
      </div>
    </div>
  );
}
