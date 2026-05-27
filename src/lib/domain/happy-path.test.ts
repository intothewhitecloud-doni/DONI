import assert from "node:assert/strict";
import test from "node:test";
import { advanceAnalysisJob, confirmCandidates, editCandidate, excludeCandidate } from "../prototype/commands/analysisCommands";
import { loginAsDemoUser } from "../prototype/commands/authCommands";
import { uploadSampleFiles } from "../prototype/commands/fileCommands";
import { createProposalFromInsight } from "../prototype/commands/insightCommands";
import { recordOutcome } from "../prototype/commands/outcomeCommands";
import { castVote, finalizeProposal } from "../prototype/commands/proposalCommands";
import { generateVerificationRecord } from "../prototype/commands/verificationCommands";
import { createInitialState } from "../prototype/store";
import { reducer, type PrototypeAction } from "./state-machine";

test("service happy path runs from enterprise login to outcome reanalysis", async () => {
  let state = createInitialState();
  const dispatch = (action: PrototypeAction) => {
    state = reducer(state, action);
  };

  assert.equal(state.screen, "home");
  assert.equal(state.entities.length, 0);
  assert.equal(state.events.length, 0);

  loginAsDemoUser(state, dispatch);
  assert.equal(state.screen, "dashboard");
  assert.equal(state.entities.length, 0);

  uploadSampleFiles(state, dispatch);
  assert.equal(state.candidates.length > 0, true);
  advanceAnalysisJob(dispatch);
  advanceAnalysisJob(dispatch);
  advanceAnalysisJob(dispatch);
  advanceAnalysisJob(dispatch);
  editCandidate(state, dispatch, "candidate-customer", "핵심 고객군 보정", "테스트 보정");
  excludeCandidate(state, dispatch, "candidate-claim-flow");
  confirmCandidates(state, dispatch);
  const insightId = state.insights[0].id;
  createProposalFromInsight(state, dispatch, insightId);
  const proposalId = state.proposals[0].id;
  castVote(state, dispatch, proposalId, "approve", "기업 관리자 해피패스 테스트");
  finalizeProposal(state, dispatch, proposalId);
  await generateVerificationRecord(state, dispatch, state.decisions[0].id);
  recordOutcome(state, dispatch, state.decisions[0].id);

  assert.equal(state.session.loggedIn, true);
  assert.equal(state.analysisJobs[0].status, "completed");
  assert.equal(state.candidates.some((candidate) => candidate.reviewerNote === "테스트 보정"), true);
  assert.equal(state.candidates.some((candidate) => candidate.status === "excluded"), true);
  assert.equal(state.proposals[0].status, "verified");
  assert.equal(state.decisions.length, 1);
  assert.equal(state.verificationRecords[0].hash.length, 64);
  assert.equal(state.outcomes[0].status, "reanalyzed");
  assert.equal(state.screen, "outcome");
});
