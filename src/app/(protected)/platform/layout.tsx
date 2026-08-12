import { PlatformShell } from "@/components/platform/platform-shell";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { listPlatformExpiryAlerts } from "@/lib/platform/expiry-alerts-queries";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requirePlatformAdmin();
  const supabase = await createClient();

  const [{ data: profile }, expiry] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    listPlatformExpiryAlerts(),
  ]);

  return (
    <PlatformShell
      adminEmail={user.email ?? "compte inconnu"}
      adminName={profile?.full_name}
      expiryAlerts={expiry.alerts}
      warningDaysBeforeExpiry={expiry.warningDays}
    >
      {children}
    </PlatformShell>
  );
}
