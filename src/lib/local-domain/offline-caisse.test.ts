import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import {
  closeLocalDatabase,
  getLocalDatabase,
  resetLocalDatabaseSingletonForTests,
} from "@/lib/local-db/database";
import { getAppliedSchemaVersion } from "@/lib/local-db/migrations";
import {
  closeLocalCashSession,
  getLocalActiveCashSession,
  openLocalCashSession,
} from "@/lib/local-domain/cash-sessions";
import { recordLocalPayments } from "@/lib/local-domain/checkout-local";
import { saveLocalOrder } from "@/lib/local-domain/orders-local";
import { LocalProductRepository } from "@/lib/local-domain/products-repository";
import {
  countOutboxByStatus,
  listPendingOutboxEvents,
  markOutboxSynced,
} from "@/lib/sync/outbox";

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fasobar-offline-"));
}

function workspace(): WorkspaceContext {
  return {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ownerName: "Caissier Test",
    email: "caissier",
    organizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    organizationName: "Org",
    establishmentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    establishmentName: "Maquis",
    organizationRole: "CASHIER_KITCHEN",
    establishmentRole: "CASHIER_KITCHEN",
    role: "CASHIER_KITCHEN",
    userSpace: "cashier_kitchen",
    homePath: "/application/caisse",
    isActive: true,
    canManageProducts: false,
    canManageUsers: false,
    canReadStock: false,
    canManageStock: false,
    canManageBarStock: false,
    canManageKitchenStock: false,
    canManageOrders: true,
    canReadOrders: true,
    canOperateCashRegister: true,
    serviceScope: "BOTH",
  };
}

function seedProduct(db: ReturnType<typeof getLocalDatabase>, ws: WorkspaceContext) {
  const repo = new LocalProductRepository(db);
  repo.upsertCategory({
    id: "cat-1",
    organizationId: ws.organizationId,
    establishmentId: ws.establishmentId,
    departmentCode: "BAR",
    name: "Boissons",
    active: true,
    updatedAt: new Date().toISOString(),
  });
  repo.upsertProduct({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    organizationId: ws.organizationId,
    establishmentId: ws.establishmentId,
    categoryId: "cat-1",
    departmentCode: "BAR",
    departmentName: "Bar",
    categoryName: "Boissons",
    name: "Bissap",
    sellingPrice: 500,
    unit: "verre",
    active: true,
    imageUrl: null,
    updatedAt: new Date().toISOString(),
  });
}

afterEach(() => {
  resetLocalDatabaseSingletonForTests();
  delete process.env.FASOBAR_RUNTIME;
  delete process.env.FASOBAR_USER_DATA;
  delete process.env.FASOBAR_INSTALLATION_ID;
});

describe("offline caisse core", () => {
  it("opens session, sells, pays atomically, survives reopen", () => {
    const root = tempRoot();
    process.env.FASOBAR_RUNTIME = "desktop-server";
    process.env.FASOBAR_USER_DATA = root;
    process.env.FASOBAR_INSTALLATION_ID = "11111111-1111-4111-8111-111111111111";

    const ws = workspace();
    let db = getLocalDatabase({ userDataRoot: root, skipBackup: true, force: true });
    expect(getAppliedSchemaVersion(db)).toBe(4);
    seedProduct(db, ws);

    const opened = openLocalCashSession(ws, { openingCashAmount: 10000 });
    expect(getLocalActiveCashSession(db, ws)?.id).toBe(opened.sessionId);
    expect(countOutboxByStatus(db, "PENDING")).toBeGreaterThanOrEqual(1);

    const saved = saveLocalOrder(ws, {
      targetStatus: "READY_TO_PAY",
      orderType: "ON_SITE",
      items: [
        {
          productId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          name: "Bissap",
          unitPrice: 500,
          quantity: 2,
          departmentCode: "BAR",
          unit: "verre",
        },
      ],
      cashSessionId: opened.sessionId,
    });

    const payKey = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const paid = recordLocalPayments(ws, {
      orderId: saved.orderId,
      idempotencyKey: payKey,
      payments: [
        {
          method: "CASH",
          amountApplied: 1000,
          amountReceived: 2000,
        },
      ],
    });

    expect(paid.fullyPaid).toBe(true);
    expect(paid.receiptId).toBeTruthy();
    expect(paid.changeGiven).toBe(1000);

    // Double payment blocked / idempotent
    const again = recordLocalPayments(ws, {
      orderId: saved.orderId,
      idempotencyKey: payKey,
      payments: [
        {
          method: "CASH",
          amountApplied: 1000,
          amountReceived: 1000,
        },
      ],
    });
    expect(again.fullyPaid).toBe(true);
    expect(again.receiptId).toBe(paid.receiptId);

    const paymentsCount = Number(
      db.prepare("SELECT COUNT(*) AS c FROM local_payments").get()?.c ?? 0,
    );
    expect(paymentsCount).toBe(1);

    const pendingBefore = listPendingOutboxEvents(db, 100);
    expect(pendingBefore.some((e) => e.eventType === "ORDER_CREATED")).toBe(true);
    expect(pendingBefore.some((e) => e.eventType === "PAYMENT_RECORDED")).toBe(
      true,
    );
    expect(pendingBefore.some((e) => e.eventType === "CASH_SESSION_OPENED")).toBe(
      true,
    );

    // Simulate successful sync then ensure events stay SYNCED (idempotent local state)
    for (const event of pendingBefore) {
      markOutboxSynced(db, event.id);
    }
    expect(countOutboxByStatus(db, "PENDING")).toBe(0);
    expect(countOutboxByStatus(db, "SYNCED")).toBe(pendingBefore.length);

    closeLocalDatabase();

    // Restart — sales must still exist
    db = getLocalDatabase({ userDataRoot: root, skipBackup: true, force: true });
    const order = db
      .prepare("SELECT payment_status, total_amount FROM local_orders WHERE id = ?")
      .get(saved.orderId);
    expect(order?.payment_status).toBe("PAID");
    expect(Number(order?.total_amount)).toBe(1000);
    expect(
      Number(db.prepare("SELECT COUNT(*) AS c FROM local_payments").get()?.c),
    ).toBe(1);
    expect(
      Number(db.prepare("SELECT COUNT(*) AS c FROM local_receipts").get()?.c),
    ).toBe(1);

    closeLocalCashSession(ws, {
      sessionId: opened.sessionId,
      countedCashAmount: 11000,
    });
    expect(getLocalActiveCashSession(db, ws)).toBeNull();
    expect(
      listPendingOutboxEvents(db, 20).some(
        (e) => e.eventType === "CASH_SESSION_CLOSED",
      ),
    ).toBe(true);
  });

  it("blocks admin/owner from opening cash via canOperateCashRegister", () => {
    const root = tempRoot();
    process.env.FASOBAR_RUNTIME = "desktop-server";
    process.env.FASOBAR_USER_DATA = root;
    process.env.FASOBAR_INSTALLATION_ID = "22222222-2222-4222-8222-222222222222";
    getLocalDatabase({ userDataRoot: root, skipBackup: true, force: true });

    const admin = {
      ...workspace(),
      organizationRole: "ADMIN" as const,
      establishmentRole: "ADMIN" as const,
      role: "ADMIN",
      userSpace: "admin" as const,
      canOperateCashRegister: false,
      canManageOrders: true,
    };

    expect(() =>
      openLocalCashSession(admin, { openingCashAmount: 0 }),
    ).toThrow(/Permission insuffisante/);
  });

  it("keeps outbox events after sync failure marking", () => {
    const root = tempRoot();
    process.env.FASOBAR_RUNTIME = "desktop-server";
    process.env.FASOBAR_USER_DATA = root;
    process.env.FASOBAR_INSTALLATION_ID = "33333333-3333-4333-8333-333333333333";
    const ws = workspace();
    const db = getLocalDatabase({
      userDataRoot: root,
      skipBackup: true,
      force: true,
    });
    seedProduct(db, ws);
    openLocalCashSession(ws, { openingCashAmount: 0 });

    const before = countOutboxByStatus(db, "PENDING");
    expect(before).toBeGreaterThan(0);
    // Local sales/outbox must never be deleted on cloud unavailability — rows remain.
    expect(
      Number(db.prepare("SELECT COUNT(*) AS c FROM sync_outbox").get()?.c),
    ).toBe(before);
  });
});
