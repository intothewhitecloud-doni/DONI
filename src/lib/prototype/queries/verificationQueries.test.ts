import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../store";
import { getVerificationDetailView } from "./verificationQueries";

test("verification detail view returns latest record history for a decision", () => {
  const initial = createInitialState();
  const state = {
    ...initial,
    decisions: [
      {
        id: "decision-1",
        finalizedAt: "2026-05-07T09:00:00.000Z",
        proposalId: "proposal-1",
        result: "approved" as const,
        summary: "확정",
        title: "테스트 의사결정"
      }
    ],
    verificationRecords: [
      {
        id: "verification-1-1",
        canonicalJson: "{}",
        decisionId: "decision-1",
        generatedAt: "2026-05-07T09:00:00.000Z",
        hash: "a".repeat(64),
        reference: "ref1",
        revision: 1,
        scopeHash: "b".repeat(64),
        status: "verified" as const,
        trustCertificationStatus: "pending" as const,
        verificationMethod: "xrpl_ready" as const,
        verifiedAt: "2026-05-07T09:00:00.000Z"
      },
      {
        id: "verification-1-2",
        canonicalJson: "{}",
        decisionId: "decision-1",
        generatedAt: "2026-05-07T10:00:00.000Z",
        hash: "c".repeat(64),
        previousVerificationId: "verification-1-1",
        reference: "ref2",
        revision: 2,
        scopeHash: "d".repeat(64),
        status: "verified" as const,
        trustCertificationStatus: "pending" as const,
        verificationMethod: "xrpl_ready" as const,
        verifiedAt: "2026-05-07T10:00:00.000Z"
      }
    ]
  };

  const view = getVerificationDetailView(state);

  assert.equal(view.decision?.id, "decision-1");
  assert.equal(view.record?.id, "verification-1-1");
  assert.deepEqual(view.history.map((record) => record.id), ["verification-1-2", "verification-1-1"]);
});
