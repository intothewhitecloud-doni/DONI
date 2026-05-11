import assert from "node:assert/strict";
import test from "node:test";
import { currentWorkspaceData, projectWorkspaceData } from "../../domain/state-machine";
import type { Decision, VerificationRecord } from "../../domain/types";
import { createInitialState } from "../store";
import { getVerificationDetailView } from "./verificationQueries";

test("verification detail view follows the selected verification record decision", () => {
  const initial = createInitialState();
  const workspaceId = initial.session.workspaceId;
  const data = currentWorkspaceData(initial);
  const firstDecision: Decision = {
    id: "decision-first",
    finalizedAt: "2026-05-07T09:00:00.000Z",
    proposalId: "proposal-first",
    result: "approved",
    summary: "첫 번째 의사결정",
    title: "첫 번째 안건"
  };
  const secondDecision: Decision = {
    id: "decision-second",
    finalizedAt: "2026-05-07T10:00:00.000Z",
    proposalId: "proposal-second",
    result: "approved",
    summary: "두 번째 의사결정",
    title: "두 번째 안건"
  };
  const firstRecord = verificationRecord("verification-first", firstDecision.id, 1);
  const secondRecord = verificationRecord("verification-second", secondDecision.id, 1);
  const state = projectWorkspaceData(
    {
      ...initial,
      navigationFocus: { screen: "verificationDetail", focusId: firstRecord.id, label: "첫 번째 검증" },
      workspaceDataById: {
        ...initial.workspaceDataById,
        [workspaceId]: {
          ...data,
          auditLogs: [
            {
              action: "검증 기록 생성",
              actorId: "user-admin",
              at: firstRecord.verifiedAt,
              id: "audit-first-verification",
              summary: "첫 번째 검증",
              targetId: firstRecord.id,
              targetType: "verification_record"
            }
          ],
          decisions: [secondDecision, firstDecision],
          verificationRecords: [secondRecord, firstRecord]
        }
      }
    },
    workspaceId
  );
  const view = getVerificationDetailView(state);

  assert.equal(view.record?.id, firstRecord.id);
  assert.equal(view.decision?.id, firstDecision.id);
  assert.deepEqual(view.history.map((record) => record.id), [firstRecord.id]);
  assert.equal(view.timeline.some((log) => log.targetId === firstRecord.id), true);
});

function verificationRecord(id: string, decisionId: string, revision: number): VerificationRecord {
  return {
    canonicalJson: "{}",
    decisionId,
    generatedAt: "2026-05-07T09:00:00.000Z",
    hash: `${id}-hash`.padEnd(64, "0").slice(0, 64),
    id,
    reference: `검증 ${revision}`,
    revision,
    scopeHash: `${id}-scope`.padEnd(64, "0").slice(0, 64),
    status: "verified",
    trustCertificationStatus: "pending",
    verificationMethod: "xrpl_ready",
    verifiedAt: "2026-05-07T09:00:00.000Z"
  };
}
