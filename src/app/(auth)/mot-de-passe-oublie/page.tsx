import { ResetPasswordRequestForm } from "@/components/auth/reset-password-request-form";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { isInternalFasoBarAuthEmail } from "@/lib/auth/login-identifier";

type MotDePasseOubliePageProps = {
  searchParams?: Promise<{ email?: string }>;
};

export default async function MotDePasseOubliePage({
  searchParams,
}: MotDePasseOubliePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const fromQuery = params?.email?.trim() ?? "";

  let defaultEmail = fromQuery;
  if (!defaultEmail) {
    const user = await getAuthenticatedUser();
    if (user?.email && !isInternalFasoBarAuthEmail(user.email)) {
      defaultEmail = user.email;
    }
  }

  return <ResetPasswordRequestForm defaultEmail={defaultEmail} />;
}
