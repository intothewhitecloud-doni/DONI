import type { PrototypeState } from "../../domain/types";
import { currentWorkspaceData } from "../selectors";
import { getTimelineForDecision } from "./auditQueries";

export function getVerificationDetailView(state: PrototypeState) {
  const data = currentWorkspaceData(state);
  const focusedRecordId = state.navigationFocus?.screen === "verificationDetail" ? state.navigationFocus.focusId : undefined;
  const record =
    data.verificationRecords.find((item) => item.id === focusedRecordId) ??
    data.verificationRecords[0];
  const decision = record
    ? data.decisions.find((item) => item.id === record.decisionId)
    : data.decisions[0];
  const decisionId = record?.decisionId ?? decision?.id;

  return {
    decision,
    history: decisionId ? verificationHistoryForDecision(data.verificationRecords, decisionId) : [],
    record,
    timeline: getTimelineForDecision(state, decisionId)
  };
}

function verificationHistoryForDecision(records: PrototypeState["verificationRecords"], decisionId: string) {
  return records
    .filter((record) => record.decisionId === decisionId)
    .sort((left, right) => {
      if (right.revision !== left.revision) {
        return right.revision - left.revision;
      }

      return Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt);
    });
}
