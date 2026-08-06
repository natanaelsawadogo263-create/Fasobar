import { redirect } from "next/navigation";

import { FirstLoginForm } from "@/components/auth/first-login-form";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getFirstLoginContext } from "@/lib/users/queries";

export default async function PremiereConnexionPage() {
  const user = await requireAuthenticatedUser();
  const context = await getFirstLoginContext(user.id);

  if (!context) {
    redirect("/application");
  }

  return (
    <div className="relative flex h-dvh max-h-dvh items-center justify-center overflow-hidden bg-[#f4f6f9] px-4 py-4 sm:px-6 sm:py-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.10),_transparent_55%)]"
      />
      <div className="relative h-full max-h-[640px] w-full max-w-[920px] md:max-h-[480px]">
        <FirstLoginForm context={context} />
      </div>
    </div>
  );
}
