export default function AccessSuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-amber-700">
          Accès suspendu
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          Votre compte est temporairement désactivé
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Contactez l&apos;administrateur de votre établissement pour réactiver votre accès.
          Votre historique d&apos;activité reste conservé.
        </p>
      </div>
    </div>
  );
}
