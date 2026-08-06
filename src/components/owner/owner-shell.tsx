import type { ReactNode } from "react";

import { OwnerShellLayout } from "@/components/owner/owner-shell-layout";

type OwnerShellProps = {
  establishmentName: string;
  organizationName: string;
  children: ReactNode;
};

export function OwnerShell({
  establishmentName,
  organizationName,
  children,
}: OwnerShellProps) {
  return (
    <OwnerShellLayout
      establishmentName={establishmentName}
      organizationName={organizationName}
    >
      {children}
    </OwnerShellLayout>
  );
}
