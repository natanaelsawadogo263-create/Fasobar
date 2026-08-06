import { redirectIfAuthenticated } from "@/lib/auth/session";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default async function InscriptionPage() {
  await redirectIfAuthenticated();

  return <SignUpForm />;
}
