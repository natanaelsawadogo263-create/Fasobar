import { SignInForm } from "@/components/auth/sign-in-form";
import { isDesktopServerRuntime } from "@/lib/desktop/runtime";

type ConnexionScreenProps = {
  authError?: string | null;
};

export async function ConnexionScreen({ authError = null }: ConnexionScreenProps) {
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
    />
  );
}
