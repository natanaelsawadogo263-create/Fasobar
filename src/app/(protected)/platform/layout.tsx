import { PlatformShell } from "@/components/platform/platform-shell";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requirePlatformAdmin();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <PlatformShell
      adminEmail={user.email ?? "compte inconnu"}
      adminName={profile?.full_name}
    >
      {children}
    </PlatformShell>
  );
}
