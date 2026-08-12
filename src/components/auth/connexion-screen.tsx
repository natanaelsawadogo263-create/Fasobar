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
    <div className="h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain bg-slate-50">
      <div className="mx-auto flex min-h-full w-full items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <SignInForm
          desktopMode={desktopMode}
          initialCloudReachable={initialCloudReachable}
          authError={authError}
        />
      </div>
    </div>
  );
}
