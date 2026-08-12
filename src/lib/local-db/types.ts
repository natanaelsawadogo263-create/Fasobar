import "server-only";

export const LOCAL_SCHEMA_VERSION = 4;

export type SyncOutboxStatus =
  | "PENDING"
  | "PROCESSING"
  | "SYNCED"
  | "FAILED"
  | "CONFLICT";

export type SyncUiStatus =
  | "ONLINE_SYNCED"
  | "ONLINE_PENDING"
  | "OFFLINE"
  | "SYNCING"
  | "ERROR";

export type LocalDbHealth = {
  ok: boolean;
  schemaVersion: number | null;
  installationId: string | null;
  message?: string;
};

export type SqlDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number };
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  };
  close(): void;
};
