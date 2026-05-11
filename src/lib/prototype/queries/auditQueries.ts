import type { PrototypeState } from "../../domain/types";
import { currentWorkspaceData } from "../selectors";

export function getTimelineForDecision(state: PrototypeState, decisionId?: string) {
  const data = currentWorkspaceData(state);
  if (!decisionId) {
    return data.auditLogs;
  }

  const decision = data.decisions.find((item) => item.id === decisionId);
  const proposalId = decision?.proposalId;
  const verificationIds = data.verificationRecords
    .filter((record) => record.decisionId === decisionId)
    .map((record) => record.id);
  const targetIds = new Set([decisionId, proposalId, ...verificationIds].filter((id): id is string => Boolean(id)));

  return data.auditLogs.filter(
    (log) =>
      targetIds.has(log.targetId) ||
      (log.targetType === "workspace" && log.action.includes("구조")) ||
      (log.targetType === "verification_record" && verificationIds.includes(log.targetId))
  );
}
