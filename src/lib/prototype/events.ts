import type { AuditLog, PrototypeState } from "../domain/types";

let auditCounter = 0;

export function makeAudit(state: PrototypeState, action: string, targetType: string, targetId: string, summary: string): AuditLog {
  auditCounter += 1;

  return {
    id: `audit-${Date.now()}-${auditCounter}`,
    at: new Date().toISOString(),
    actorId: state.session.currentUserId,
    action,
    targetType,
    targetId,
    summary
  };
}

export function commandMeta(
  state: PrototypeState,
  action: string,
  targetType: string,
  targetId: string,
  summary: string
): { auditLog: AuditLog; now: string } {
  const auditLog = makeAudit(state, action, targetType, targetId, summary);
  return { auditLog, now: auditLog.at };
}
