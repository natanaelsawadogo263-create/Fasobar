import { isBusinessActivityId } from "@/lib/auth/activities";

export function isHardwareActivity(
  activityCode: string | null | undefined,
): boolean {
  return activityCode === "hardware";
}

export function isHardwareEstablishment(
  activityCode: string | null | undefined,
): boolean {
  return isBusinessActivityId(activityCode) && isHardwareActivity(activityCode);
}

/** Admin quincaillerie : vend sans écran d’ouverture de caisse ; la vente reste à son nom. */
export function isHardwareAdminDirectSeller(actor: {
  activityCode?: string | null;
  userSpace?: string | null;
}): boolean {
  return isHardwareActivity(actor.activityCode) && actor.userSpace === "admin";
}
