import "server-only";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";

export type ApplicationContext = {
  ownerName: string;
  organizationName: string;
  establishmentName: string;
  role: string;
};

export async function getApplicationContext(
  userId: string,
): Promise<ApplicationContext | null> {
  const context = await getWorkspaceContext(userId);

  if (!context) {
    return null;
  }

  return {
    ownerName: context.ownerName,
    organizationName: context.organizationName,
    establishmentName: context.establishmentName,
    role: context.organizationRole,
  };
}
