import "server-only";

import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PlatformAdminRow = {
  id: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  createdBy: string | null;
};

export type PlatformAdminsResult = {
  admins: PlatformAdminRow[];
  error: string | null;
};

function isMissingTableError(message: string): boolean {
  return /Could not find the table|schema cache|does not exist|PGRST205/i.test(
    message,
  );
}

async function fetchEmails(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  if (!isAdminClientConfigured() || userIds.length === 0) return emails;

  try {
    const admin = createAdminClient();
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const { data } = await admin.auth.admin.getUserById(userId);
          if (data.user?.email) {
            emails.set(userId, data.user.email.toLowerCase());
          }
        } catch (error) {
          console.error("[platform] admin email fetch failed:", userId, error);
        }
      }),
    );
  } catch (error) {
    console.error("[platform] admin client unavailable:", error);
  }

  return emails;
}

export async function listPlatformAdmins(): Promise<PlatformAdminsResult> {
  try {
    const supabase = await createClient();

    const adminsResult = await supabase
      .from("platform_admins")
      .select("id, user_id, status, created_at, created_by")
      .order("created_at", { ascending: false });

    if (adminsResult.error) {
      if (isMissingTableError(adminsResult.error.message)) {
        return { admins: [], error: null };
      }
      console.error("[platform] listPlatformAdmins:", adminsResult.error.message);
      return { admins: [], error: adminsResult.error.message };
    }

    const userIds = [...new Set((adminsResult.data ?? []).map((a) => a.user_id))];

    // Ne charge que les profils des admins listés — jamais la table profiles entière.
    const [profilesResult, emails] = await Promise.all([
      userIds.length > 0
        ? supabase.from("profiles").select("id, full_name, phone").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      fetchEmails(userIds),
    ]);

    const profileById = new Map(
      (profilesResult.data ?? []).map((p) => [p.id, p] as const),
    );

    const admins: PlatformAdminRow[] = (adminsResult.data ?? []).map((row) => {
      const profile = profileById.get(row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        fullName: profile?.full_name ?? null,
        email: emails.get(row.user_id) ?? null,
        phone: profile?.phone ?? null,
        status: row.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        createdAt: row.created_at,
        createdBy: row.created_by,
      };
    });

    return { admins, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inattendue.";
    console.error("[platform] listPlatformAdmins failed:", error);
    return { admins: [], error: message };
  }
}
