import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  closeLocalDatabase,
  foreignKeysEnabled,
  getJournalMode,
  getLocalDatabase,
  getLocalDbHealth,
  resetLocalDatabaseSingletonForTests,
} from "@/lib/local-db/database";
import {
  applyMigrations,
  getAppliedSchemaVersion,
  loadMigrationDefinitions,
} from "@/lib/local-db/migrations";
import { backupLocalDatabase } from "@/lib/local-db/backup";
import { resolveLocalDataPaths } from "@/lib/local-db/paths";
import { withTransaction } from "@/lib/local-db/transaction";
import { nextLocalNumber } from "@/lib/local-domain/numbering";
import { LocalProductRepository } from "@/lib/local-domain/products-repository";
import { writeWithOutbox, countOutboxByStatus } from "@/lib/sync/outbox";
import { resolveSyncUiStatus } from "@/lib/sync/status";
import {
  getFasoBarRuntime,
  isDesktopServerRuntime,
} from "@/lib/desktop/runtime";

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fasobar-local-"));
}

afterEach(() => {
  resetLocalDatabaseSingletonForTests();
  delete process.env.FASOBAR_RUNTIME;
  delete process.env.FASOBAR_USER_DATA;
  delete process.env.FASOBAR_INSTALLATION_ID;
});

describe("desktop runtime detection", () => {
  it("defaults to web without FASOBAR_RUNTIME", () => {
    expect(getFasoBarRuntime()).toBe("web");
    expect(isDesktopServerRuntime()).toBe(false);
  });

  it("detects desktop-server explicitly", () => {
    process.env.FASOBAR_RUNTIME = "desktop-server";
    expect(isDesktopServerRuntime()).toBe(true);
  });
});

describe("local sqlite database", () => {
  it("creates db, applies migrations once, enables WAL and FK", () => {
    const root = tempRoot();
    process.env.FASOBAR_INSTALLATION_ID = "11111111-1111-4111-8111-111111111111";
    const db = getLocalDatabase({ userDataRoot: root, skipBackup: true, force: true });

    expect(getAppliedSchemaVersion(db)).toBe(6);
    expect(getJournalMode(db)).toBe("wal");
    expect(foreignKeysEnabled(db)).toBe(true);

    const again = applyMigrations(db, loadMigrationDefinitions());
    expect(again).toBe(6);
    expect(
      db.prepare("SELECT COUNT(*) AS c FROM local_schema_migrations").get()?.c,
    ).toBe(6);

    const health = getLocalDbHealth();
    expect(health.ok).toBe(true);
    expect(health.installationId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(health.schemaVersion).toBe(6);

    const paths = resolveLocalDataPaths(root);
    expect(fs.existsSync(paths.databaseFile)).toBe(true);
  });

  it("keeps installation_id stable across reopen", () => {
    const root = tempRoot();
    process.env.FASOBAR_INSTALLATION_ID = "22222222-2222-4222-8222-222222222222";
    const first = getLocalDatabase({
      userDataRoot: root,
      skipBackup: true,
      force: true,
    });
    const id1 = first
      .prepare("SELECT installation_id AS id FROM local_installation WHERE id = 1")
      .get()?.id;
    closeLocalDatabase();

    delete process.env.FASOBAR_INSTALLATION_ID;
    const second = getLocalDatabase({
      userDataRoot: root,
      skipBackup: true,
      force: true,
    });
    const id2 = second
      .prepare("SELECT installation_id AS id FROM local_installation WHERE id = 1")
      .get()?.id;
    expect(id2).toBe(id1);
  });

  it("writes outbox atomically with domain data", () => {
    const root = tempRoot();
    const db = getLocalDatabase({ userDataRoot: root, skipBackup: true, force: true });
    const mutationId = "33333333-3333-4333-8333-333333333333";

    writeWithOutbox(
      db,
      () => {
        db.prepare(
          `INSERT INTO local_orders (
            id, client_mutation_id, organization_id, establishment_id,
            local_order_number, status, subtotal, discount_amount, total_amount,
            device_id, created_at, updated_at, sync_status
          ) VALUES (?, ?, 'org', 'est', 'LOCAL-CAISSE-000001', 'OPEN', 0, 0, 0, 'dev', ?, ?, 'PENDING')`,
        ).run(
          "44444444-4444-4444-8444-444444444444",
          mutationId,
          new Date().toISOString(),
          new Date().toISOString(),
        );
      },
      {
        clientMutationId: mutationId,
        organizationId: "org",
        establishmentId: "est",
        deviceId: "dev",
        aggregateType: "order",
        aggregateId: "44444444-4444-4444-8444-444444444444",
        eventType: "order.created",
        payload: { total: 0 },
      },
    );

    expect(countOutboxByStatus(db, "PENDING")).toBe(1);
    expect(
      db.prepare("SELECT COUNT(*) AS c FROM local_orders").get()?.c,
    ).toBe(1);

    expect(() =>
      writeWithOutbox(
        db,
        () => undefined,
        {
          clientMutationId: mutationId,
          organizationId: "org",
          establishmentId: "est",
          deviceId: "dev",
          aggregateType: "order",
          aggregateId: "x",
          eventType: "order.created",
          payload: {},
        },
      ),
    ).toThrow();
  });

  it("rolls back domain write if outbox insert fails", () => {
    const root = tempRoot();
    const db = getLocalDatabase({ userDataRoot: root, skipBackup: true, force: true });

    expect(() =>
      withTransaction(db, () => {
        db.prepare(
          `INSERT INTO local_orders (
            id, client_mutation_id, organization_id, establishment_id,
            local_order_number, status, device_id, created_at, updated_at, sync_status
          ) VALUES ('a', 'm1', 'org', 'est', 'N1', 'OPEN', 'dev', ?, ?, 'PENDING')`,
        ).run(new Date().toISOString(), new Date().toISOString());
        throw new Error("force fail");
      }),
    ).toThrow();

    expect(db.prepare("SELECT COUNT(*) AS c FROM local_orders").get()?.c).toBe(0);
  });

  it("generates stable local numbers", () => {
    const root = tempRoot();
    const db = getLocalDatabase({ userDataRoot: root, skipBackup: true, force: true });
    expect(nextLocalNumber(db, "orders")).toBe("LOCAL-CAISSE-000001");
    expect(nextLocalNumber(db, "orders")).toBe("LOCAL-CAISSE-000002");
  });

  it("supports catalog upsert and offline read", () => {
    const root = tempRoot();
    const db = getLocalDatabase({ userDataRoot: root, skipBackup: true, force: true });
    const repo = new LocalProductRepository(db);

    repo.upsertCategory({
      id: "cat-1",
      organizationId: "org",
      establishmentId: "est",
      departmentCode: "BAR",
      name: "Boissons",
      active: true,
      updatedAt: new Date().toISOString(),
    });
    repo.upsertProduct({
      id: "prod-1",
      organizationId: "org",
      establishmentId: "est",
      categoryId: "cat-1",
      departmentCode: "BAR",
      departmentName: "Bar",
      categoryName: "Boissons",
      name: "Bissap",
      sellingPrice: 500,
      unit: "UNIT",
      active: true,
      imageUrl: null,
      updatedAt: new Date().toISOString(),
    });

    closeLocalDatabase();
    const reopened = getLocalDatabase({
      userDataRoot: root,
      skipBackup: true,
      force: true,
    });
    const products = new LocalProductRepository(reopened).listCashierProducts(
      "est",
    );
    expect(products).toHaveLength(1);
    expect(products[0]?.name).toBe("Bissap");
    expect(resolveSyncUiStatus(reopened)).toMatch(/ONLINE|OFFLINE|ERROR|SYNCING/);
  });

  it("creates a backup without exposing db path in health", () => {
    const root = tempRoot();
    const db = getLocalDatabase({ userDataRoot: root, skipBackup: true, force: true });
    const paths = resolveLocalDataPaths(root);
    const backup = backupLocalDatabase(db, paths);
    expect(fs.existsSync(backup)).toBe(true);

    const health = getLocalDbHealth();
    expect(JSON.stringify(health)).not.toContain(paths.databaseFile);
    expect(JSON.stringify(health)).not.toMatch(/[A-Za-z]:\\\\/);
  });
});
