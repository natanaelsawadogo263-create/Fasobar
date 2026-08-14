import { ADMIN_ROLES, type UserSpace } from "@/lib/auth/roles";
import { isHardwareActivity } from "@/lib/hardware/activity";

export type HardwareActor = {
  activityCode?: string | null;
  userSpace: UserSpace;
  organizationRole: string;
  establishmentRole: string;
};

function isAdminActor(actor: HardwareActor): boolean {
  return (
    actor.userSpace === "admin" ||
    ADMIN_ROLES.has(actor.organizationRole) ||
    ADMIN_ROLES.has(actor.establishmentRole)
  );
}

export function hardwarePermissions(actor: HardwareActor) {
  const enabled = isHardwareActivity(actor.activityCode);
  const admin = enabled && isAdminActor(actor);
  const cashier = enabled && actor.userSpace === "cashier_kitchen";
  const stockManager = enabled && actor.userSpace === "bar_manager";

  return {
    enabled,
    canSell: admin || cashier,
    canOperateOwnCashSession: admin || cashier,
    canCreateCustomer: admin,
    canEditCustomer: admin,
    canSelectCustomer: admin || cashier,
    canGrantCredit: admin || cashier,
    canEditPrice: admin,
    canEditDiscountRule: admin,
    canApplyConfiguredDiscount: admin || cashier,
    canManageCatalog: admin || stockManager,
    canManageStock: admin || stockManager,
    canManageSuppliers: admin || stockManager,
    canManagePurchaseOrders: admin || stockManager,
    canCreateExpense: admin || stockManager,
    canManageUsers: admin,
    canManageSettings: admin,
    canDeleteSale: false,
    canCancelSaleWithReason: admin || cashier,
    canViewLiveRegisters: admin,
    canViewPerformance: admin,
  };
}

export function assertHardwarePermission(
  actor: HardwareActor,
  key: keyof ReturnType<typeof hardwarePermissions>,
): boolean {
  const permissions = hardwarePermissions(actor);
  if (key === "enabled") return permissions.enabled;
  return Boolean(permissions[key]);
}
