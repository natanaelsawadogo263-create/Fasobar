/**
 * Ambient types for Node.js experimental `node:sqlite` (DatabaseSync).
 * Kept local until @types/node ships stable definitions for our toolchain.
 */
declare module "node:sqlite" {
  export type StatementResultingChanges = {
    changes: number;
    lastInsertRowid: number | bigint;
  };

  export class StatementSync {
    run(...params: unknown[]): StatementResultingChanges;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
    iterate(...params: unknown[]): IterableIterator<Record<string, unknown>>;
  }

  export type DatabaseSyncOptions = {
    open?: boolean;
    readOnly?: boolean;
    enableForeignKeyConstraints?: boolean;
    timeout?: number;
  };

  export class DatabaseSync {
    constructor(path: string, options?: DatabaseSyncOptions);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    open(): void;
    isOpen?: boolean;
  }
}
