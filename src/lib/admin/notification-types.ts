export type AdminNotificationKind =
  | "SALE"
  | "ORDER"
  | "SUPPLY"
  | "LOSS"
  | "CASH_SESSION_OPEN"
  | "CASH_SESSION_CLOSE"
  | "BAR_SESSION_OPEN"
  | "BAR_SESSION_CLOSE"
  | "EXPENSE";

export type AdminNotificationItem = {
  id: string;
  kind: AdminNotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  read: boolean;
};
