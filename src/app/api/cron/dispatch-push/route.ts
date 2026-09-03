import "server-only";

import { NextResponse } from "next/server";
import webpush from "web-push";

import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { listPlatformExpiryAlerts } from "@/lib/platform/expiry-alerts-queries";

export const dynamic = "force-dynamic";

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type AdminNotificationRow = {
  id: string;
  establishment_id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
};

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function vapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

/** Envoie à un abonnement ; renvoie false si l'abonnement est mort (à nettoyer). */
async function sendOne(
  sub: PushSubscriptionRow,
  payload: { title: string; body: string; href: string; tag: string },
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    );
    return true;
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : null;
    if (statusCode === 404 || statusCode === 410) {
      return false;
    }
    console.error("[push] send failed:", sub.id, error);
    return true; // erreur transitoire — ne pas supprimer l'abonnement
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminClientConfigured()) {
    return NextResponse.json(
      { error: "Supabase admin non configuré" },
      { status: 500 },
    );
  }
  if (!vapidConfigured()) {
    return NextResponse.json({ error: "VAPID non configuré" }, { status: 500 });
  }

  webpush.setVapidDetails(
    "mailto:contact@fasobar.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const admin = createAdminClient();
  const deadSubscriptionIds = new Set<string>();
  let sent = 0;

  async function pushToUsers(
    userIds: string[],
    payload: { title: string; body: string; href: string; tag: string },
  ) {
    if (userIds.length === 0) return;
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    await Promise.all(
      (subs ?? []).map(async (sub) => {
        const alive = await sendOne(sub as PushSubscriptionRow, payload);
        if (alive) {
          sent++;
        } else {
          deadSubscriptionIds.add((sub as PushSubscriptionRow).id);
        }
      }),
    );
  }

  // 1) Notifications Admin / Responsable Bar (admin_notifications) ----------
  const { data: pendingNotifs, error: notifsError } = await admin
    .from("admin_notifications")
    .select("id, establishment_id, kind, title, body, href")
    .is("pushed_at", null)
    .order("created_at", { ascending: true })
    .limit(100);

  if (notifsError) {
    console.error("[push] admin_notifications fetch failed:", notifsError.message);
  }

  for (const notif of (pendingNotifs ?? []) as AdminNotificationRow[]) {
    const { data: recipients, error: recipientsError } = await admin.rpc(
      "push_recipients_for_admin_notification",
      { p_establishment_id: notif.establishment_id, p_kind: notif.kind },
    );
    if (recipientsError) {
      console.error(
        "[push] recipients lookup failed:",
        notif.id,
        recipientsError.message,
      );
    } else {
      const userIds = (recipients ?? []).map(
        (row: { user_id: string }) => row.user_id,
      );
      await pushToUsers(userIds, {
        title: notif.title,
        body: notif.body ?? "",
        href: notif.href ?? "/application/tableau-de-bord",
        tag: `admin-notification:${notif.id}`,
      });
    }

    await admin
      .from("admin_notifications")
      .update({ pushed_at: new Date().toISOString() })
      .eq("id", notif.id);
  }

  // 2) Échéances Super Admin (calculées à la volée) --------------------------
  const { alerts } = await listPlatformExpiryAlerts(admin);

  if (alerts.length > 0) {
    const { data: alreadyPushed } = await admin
      .from("platform_expiry_alert_pushes")
      .select("alert_id")
      .in(
        "alert_id",
        alerts.map((a) => a.id),
      );
    const pushedIds = new Set((alreadyPushed ?? []).map((r) => r.alert_id));
    const newAlerts = alerts.filter((a) => !pushedIds.has(a.id));

    if (newAlerts.length > 0) {
      const { data: platformAdmins } = await admin
        .from("platform_admins")
        .select("user_id")
        .eq("status", "ACTIVE");
      const adminUserIds = (platformAdmins ?? []).map(
        (row: { user_id: string }) => row.user_id,
      );

      for (const alert of newAlerts) {
        await pushToUsers(adminUserIds, {
          title:
            alert.kind === "trial"
              ? `Essai bientôt expiré — ${alert.organizationName}`
              : `Abonnement bientôt expiré — ${alert.organizationName}`,
          body: `${alert.daysRemaining} j restants · ${alert.planName ?? ""}`,
          href: "/platform",
          tag: `expiry-alert:${alert.id}`,
        });
      }

      await admin
        .from("platform_expiry_alert_pushes")
        .upsert(
          newAlerts.map((a) => ({ alert_id: a.id })),
          { onConflict: "alert_id" },
        );
    }
  }

  // 3) Nettoyage des abonnements morts ---------------------------------------
  if (deadSubscriptionIds.size > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("id", [...deadSubscriptionIds]);
  }

  return NextResponse.json({
    ok: true,
    sent,
    cleaned: deadSubscriptionIds.size,
    notificationsProcessed: pendingNotifs?.length ?? 0,
  });
}
