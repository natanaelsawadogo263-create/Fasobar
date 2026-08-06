import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { roleToSpaceLabel } from "@/lib/auth/roles";
import type { FirstLoginContext, TeamMemberRow, UsersPageData } from "@/lib/users/types";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function fetchMemberEmails(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();

  if (!isAdminClientConfigured() || userIds.length === 0) {
    return emails;
  }

  const admin = createAdminClient();

  await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      if (data.user?.email) {
        emails.set(userId, data.user.email.toLowerCase());
      }
    }),
  );

  return emails;
}

export async function profileRequiresPasswordChange(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", userId)
    .maybeSingle();

  return Boolean(data?.must_change_password);
}

export async function getFirstLoginContext(userId: string): Promise<FirstLoginContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.must_change_password) {
    return null;
  }

  const { data: estMembership } = await supabase
    .from("establishment_memberships")
    .select("role, establishments(name)")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();

  const establishment = readSingle(
    estMembership?.establishments as { name: string } | { name: string }[] | null,
  );

  return {
    fullName: profile.full_name ?? "Utilisateur",
    email: user?.email ?? "",
    establishmentName: establishment?.name ?? "—",
    spaceLabel: roleToSpaceLabel(estMembership?.role ?? "ADMIN"),
  };
}

export async function listUsersPageData(
  workspace: WorkspaceContext,
): Promise<UsersPageData> {
  const supabase = await createClient();

  const { data: establishments } = await supabase
    .from("establishments")
    .select("id, name")
    .eq("organization_id", workspace.organizationId)
    .eq("status", "ACTIVE")
    .order("name");

  const { data: orgMembers } = await supabase
    .from("organization_memberships")
    .select(
      "user_id, role, status, created_at, profiles(id, full_name, phone, status, must_change_password)",
    )
    .eq("organization_id", workspace.organizationId)
    .neq("role", "OWNER");

  const memberUserIds = (orgMembers ?? []).map((row) => row.user_id);
  const emailByUserId = await fetchMemberEmails(memberUserIds);

  const memberRows: TeamMemberRow[] = [];

  for (const row of orgMembers ?? []) {
    const profile = readSingle(
      row.profiles as
        | {
            id: string;
            full_name: string | null;
            phone: string | null;
            status: string;
            must_change_password: boolean;
          }
        | Array<{
            id: string;
            full_name: string | null;
            phone: string | null;
            status: string;
            must_change_password: boolean;
          }>
        | null,
    );

    if (!profile) continue;

    const { data: estMembership } = await supabase
      .from("establishment_memberships")
      .select("establishment_id, establishments(name)")
      .eq("user_id", row.user_id)
      .limit(1)
      .maybeSingle();

    const establishment = readSingle(
      estMembership?.establishments as { name: string } | { name: string }[] | null,
    );

    memberRows.push({
      id: row.user_id,
      userId: row.user_id,
      fullName: profile.full_name ?? "—",
      email: emailByUserId.get(row.user_id) ?? "—",
      phone: profile.phone,
      role: row.role,
      spaceLabel: roleToSpaceLabel(row.role),
      establishmentId: estMembership?.establishment_id ?? workspace.establishmentId,
      establishmentName: establishment?.name ?? workspace.establishmentName,
      status: row.status === "ACTIVE" && profile.status === "ACTIVE" ? "active" : "inactive",
      mustChangePassword: profile.must_change_password,
      createdAt: row.created_at,
    });
  }

  const activeUsers = memberRows.filter((row) => row.status === "active").length;
  const inactiveUsers = memberRows.filter((row) => row.status === "inactive").length;
  const cashierKitchenCount = memberRows.filter(
    (row) => row.spaceLabel === roleToSpaceLabel("CASHIER_KITCHEN"),
  ).length;
  const barManagerCount = memberRows.filter(
    (row) => row.spaceLabel === roleToSpaceLabel("BAR_MANAGER"),
  ).length;
  const mustChangePasswordCount = memberRows.filter(
    (row) => row.mustChangePassword && row.status === "active",
  ).length;

  return {
    members: memberRows,
    establishments: establishments ?? [],
    stats: {
      activeUsers,
      cashierKitchenCount,
      barManagerCount,
      mustChangePasswordCount,
      inactiveUsers,
    },
  };
}
