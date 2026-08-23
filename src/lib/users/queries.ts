import "server-only";

import { cache } from "react";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { roleToSpaceLabel } from "@/lib/auth/roles";
import type { FirstLoginContext, TeamMemberRow, UsersPageData } from "@/lib/users/types";
import { createClient } from "@/lib/supabase/server";

function readSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export const profileRequiresPasswordChange = cache(
  async (userId: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", userId)
    .maybeSingle();

  return Boolean(data?.must_change_password);
});

export async function getFirstLoginContext(userId: string): Promise<FirstLoginContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, must_change_password, login_identifier")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.must_change_password) {
    return null;
  }

  const [{ data: estMembership }, { data: orgMembership }] = await Promise.all([
    supabase
      .from("establishment_memberships")
      .select("role, establishments(name, activity_code)")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle(),
  ]);

  const establishment = readSingle(
    estMembership?.establishments as
      | { name: string; activity_code?: string | null }
      | { name: string; activity_code?: string | null }[]
      | null,
  );

  const { isInternalFasoBarAuthEmail } = await import(
    "@/lib/auth/login-identifier"
  );
  const loginIdentifier =
    profile.login_identifier?.trim() ||
    (user?.email && !isInternalFasoBarAuthEmail(user.email)
      ? user.email
      : user?.email?.split("@")[0] ?? "");

  // Libellé d'espace propre à l'activité (ex. « Caissier » en Alimentation, pas
  // toujours « Cuisine »/« Bar » — mêmes libellés que ceux vus par l'admin à la
  // création du compte).
  const { resolveUserSpace } = await import("@/lib/auth/roles");
  const { displaySpaceLabel } = await import("@/lib/activity/profile");
  const userSpace = resolveUserSpace(
    orgMembership?.role ?? "",
    estMembership?.role ?? "ADMIN",
  );
  const spaceLabel = displaySpaceLabel(userSpace, establishment?.activity_code ?? null);

  return {
    fullName: profile.full_name ?? "Utilisateur",
    loginIdentifier,
    establishmentName: establishment?.name ?? "—",
    spaceLabel,
  };
}

export async function listUsersPageData(
  workspace: WorkspaceContext,
): Promise<UsersPageData> {
  const supabase = await createClient();

  const [{ data: establishments }, { data: orgMembers }] = await Promise.all([
    supabase
      .from("establishments")
      .select("id, name")
      .eq("organization_id", workspace.organizationId)
      .eq("status", "ACTIVE")
      .order("name"),
    supabase
      .from("organization_memberships")
      .select(
        "user_id, role, status, created_at, profiles(id, full_name, phone, status, must_change_password, login_identifier, credential_version)",
      )
      .eq("organization_id", workspace.organizationId)
      .neq("role", "OWNER"),
  ]);

  const memberUserIds = (orgMembers ?? []).map((row) => row.user_id);

  const { data: estMemberships } =
    memberUserIds.length > 0
      ? await supabase
          .from("establishment_memberships")
          .select("user_id, establishment_id, establishments(name)")
          .in("user_id", memberUserIds)
      : { data: [] as Array<Record<string, unknown>> };

  const estByUserId = new Map<
    string,
    { establishmentId: string; establishmentName: string }
  >();
  for (const row of estMemberships ?? []) {
    const userId = String(row.user_id);
    if (estByUserId.has(userId)) continue;
    const establishment = readSingle(
      row.establishments as { name: string } | { name: string }[] | null,
    );
    estByUserId.set(userId, {
      establishmentId: String(row.establishment_id),
      establishmentName: establishment?.name ?? workspace.establishmentName,
    });
  }

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
            login_identifier: string | null;
            credential_version: number | null;
          }
        | Array<{
            id: string;
            full_name: string | null;
            phone: string | null;
            status: string;
            must_change_password: boolean;
            login_identifier: string | null;
            credential_version: number | null;
          }>
        | null,
    );

    if (!profile) continue;

    const estInfo = estByUserId.get(row.user_id);
    const loginIdentifier = profile.login_identifier?.trim() || "—";

    memberRows.push({
      id: row.user_id,
      userId: row.user_id,
      fullName: profile.full_name ?? "—",
      loginIdentifier,
      // Identifiant métier (évite N appels Auth Admin getUserById).
      email: loginIdentifier,
      phone: profile.phone,
      role: row.role,
      spaceLabel: roleToSpaceLabel(row.role),
      establishmentId: estInfo?.establishmentId ?? workspace.establishmentId,
      establishmentName: estInfo?.establishmentName ?? workspace.establishmentName,
      status: row.status === "ACTIVE" && profile.status === "ACTIVE" ? "active" : "inactive",
      mustChangePassword: profile.must_change_password,
      credentialVersion: Number(profile.credential_version ?? 1),
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
