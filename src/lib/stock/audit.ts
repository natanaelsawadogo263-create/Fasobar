import "server-only";

import { createClient } from "@/lib/supabase/server";

type AuditAction =
  | "STOCK_ENTRY_RECORDED"
  | "STOCK_LOSS_RECORDED"
  | "STOCK_ADJUSTMENT_RECORDED"
  | "PRODUCT_DEACTIVATED"
  | "PRODUCT_ACTIVATED";

type WriteAuditLogInput = {
  organizationId: string;
  establishmentId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorId: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLogEntry(input: WriteAuditLogInput): Promise<void> {
  const supabase = await createClient();

  await supabase.from("audit_logs").insert({
    organization_id: input.organizationId,
    establishment_id: input.establishmentId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    actor_id: input.actorId,
    metadata: input.metadata ?? {},
  });
}
