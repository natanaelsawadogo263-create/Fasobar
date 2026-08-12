import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type {
  AdminNotificationItem,
  AdminNotificationKind,
} from "@/lib/admin/notification-types";
import { createClient } from "@/lib/supabase/server";

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  created_at: string;
};

export async function listAdminNotifications(
  workspace: WorkspaceContext,
  limit = 30,
): Promise<{ items: AdminNotificationItem[]; unreadCount: number }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_notifications")
    .select("id, kind, title, body, href, created_at")
    .eq("establishment_id", workspace.establishmentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    // Migration not applied yet — keep admin UI working.
    if (
      error.message.toLowerCase().includes("does not exist") ||
      error.code === "42P01" ||
      error.code === "PGRST205"
    ) {
      return { items: [], unreadCount: 0 };
    }
    throw error;
  }

  const rows = (data ?? []) as NotificationRow[];
  if (rows.length === 0) {
    return { items: [], unreadCount: 0 };
  }

  const ids = rows.map((row) => row.id);
  const { data: reads } = await supabase
    .from("admin_notification_reads")
    .select("notification_id")
    .eq("user_id", workspace.userId)
    .in("notification_id", ids);

  const readIds = new Set(
    (reads ?? []).map((row) => String((row as { notification_id: string }).notification_id)),
  );

  const items: AdminNotificationItem[] = rows.map((row) => ({
    id: row.id,
    kind: row.kind as AdminNotificationKind,
    title: row.title,
    body: row.body,
    href: row.href,
    createdAt: row.created_at,
    read: readIds.has(row.id),
  }));

  return {
    items,
    unreadCount: items.filter((item) => !item.read).length,
  };
}
