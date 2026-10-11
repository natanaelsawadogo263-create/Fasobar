import { SignInForm } from "@/components/auth/sign-in-form";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";

type ConnexionScreenProps = {
  authError?: string | null;
  authNotice?: string | null;
};

export async function ConnexionScreen({
  authError = null,
  authNotice = null,
}: ConnexionScreenProps) {
  const desktopMode = isDesktopServerRuntime();

  let initialCloudReachable: boolean | null = null;
  if (desktopMode) {
    try {
      const { probeSupabaseReachable } = await import(
        "@/lib/desktop/cloud-reachability"
      );
      initialCloudReachable = await probeSupabaseReachable();
    } catch {
      initialCloudReachable = false;
    }
  }

  return (
    <SignInForm
      desktopMode={desktopMode}
      initialCloudReachable={initialCloudReachable}
      authError={authError}
      authNotice={authNotice}
    />
  );
}
