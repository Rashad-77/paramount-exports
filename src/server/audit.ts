import "server-only";
import { auditLogs } from "@/lib/db/schema";
import type { DbOrTx } from "@/lib/db/client";
import type { Actor } from "@/lib/auth/permissions";

export interface AuditEntry {
  action: string; // e.g. "inventory.adjust", "payment.void", "user.role_granted"
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  requestId?: string;
}

/**
 * Write an audit record. ALWAYS pass the same transaction handle as the change being audited, so
 * the audit row commits or rolls back together with it.
 */
export async function recordAudit(tx: DbOrTx, actor: Actor | null, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: actor?.id ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
    requestId: entry.requestId ?? null,
  });
}
