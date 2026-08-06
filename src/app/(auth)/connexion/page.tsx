import { redirectIfAuthenticated } from "@/lib/auth/session";
import { SignInForm } from "@/components/auth/sign-in-form";

export default async function ConnexionPage() {
  await redirectIfAuthenticated();

  return <SignInForm />;
}
