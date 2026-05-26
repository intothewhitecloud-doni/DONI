import assert from "node:assert/strict";
import test from "node:test";
import type { Proposal, Vote } from "../domain/types";
import { summarizeVotes } from "./voting";

const proposal: Proposal = {
  id: "proposal-test",
  insightId: "insight-test",
  title: "테스트 안건",
  status: "voting",
  summary: "테스트",
  expectedImpact: "테스트",
  votingRule: {
    quorumPercent: 50,
    approvalPercent: 60,
    allowAbstain: true,
    allowVoteChange: true,
    tieBreakerRole: "owner"
  },
  voterUserIds: ["u1", "u2", "u3"],
  deadline: "2026-05-08T09:00:00.000Z",
  createdAt: "2026-05-07T09:00:00.000Z",
  comments: []
};

test("summarizeVotes passes when quorum and approval are satisfied", () => {
  const votes: Vote[] = [
    { id: "v1", proposalId: proposal.id, voterId: "u1", choice: "approve", reason: "", votedAt: "" },
    { id: "v2", proposalId: proposal.id, voterId: "u2", choice: "approve", reason: "", votedAt: "" },
    { id: "v3", proposalId: proposal.id, voterId: "u3", choice: "reject", reason: "", votedAt: "" }
  ];

  const summary = summarizeVotes(proposal, votes);

  assert.equal(summary.quorumSatisfied, true);
  assert.equal(summary.approvalSatisfied, true);
  assert.equal(summary.passed, true);
});

test("summarizeVotes blocks when quorum is not satisfied", () => {
  const summary = summarizeVotes(proposal, [
    { id: "v1", proposalId: proposal.id, voterId: "u1", choice: "approve", reason: "", votedAt: "" }
  ]);

  assert.equal(summary.quorumSatisfied, false);
  assert.equal(summary.passed, false);
});

test("summarizeVotes uses the latest vote per voter", () => {
  const summary = summarizeVotes(proposal, [
    { id: "v1", proposalId: proposal.id, voterId: "u1", choice: "reject", reason: "", votedAt: "1" },
    { id: "v1b", proposalId: proposal.id, voterId: "u1", choice: "approve", reason: "", votedAt: "2" },
    { id: "v2", proposalId: proposal.id, voterId: "u2", choice: "approve", reason: "", votedAt: "2" }
  ]);

  assert.equal(summary.approve, 2);
  assert.equal(summary.reject, 0);
});

test("summarizeVotes counts abstain toward participation but not approval", () => {
  const summary = summarizeVotes(proposal, [
    { id: "v1", proposalId: proposal.id, voterId: "u1", choice: "approve", reason: "", votedAt: "" },
    { id: "v2", proposalId: proposal.id, voterId: "u2", choice: "abstain", reason: "", votedAt: "" }
  ]);

  assert.equal(summary.abstain, 1);
  assert.equal(summary.quorumSatisfied, true);
  assert.equal(summary.approvalPercent, 50);
  assert.equal(summary.passed, false);
});

test("summarizeVotes exposes tied decisions for tie-breaker handling", () => {
  const summary = summarizeVotes(proposal, [
    { id: "v1", proposalId: proposal.id, voterId: "u1", choice: "approve", reason: "", votedAt: "" },
    { id: "v2", proposalId: proposal.id, voterId: "u2", choice: "reject", reason: "", votedAt: "" }
  ]);

  assert.equal(summary.tied, true);
  assert.equal(summary.passed, false);
});
