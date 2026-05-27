import assert from "node:assert/strict";
import test from "node:test";
import { reducer, type PrototypeAction } from "../../domain/state-machine";
import { createInitialState } from "../store";
import { confirmCandidates, startAnalysisJob } from "./analysisCommands";
import { loginWithCredentials } from "./authCommands";
import { uploadSampleFiles } from "./fileCommands";
import { createProposalFromInsight } from "./insightCommands";
import { castVote, finalizeProposal } from "./proposalCommands";
import { generateVerificationRecord } from "./verificationCommands";

test("generateVerificationRecord requires a finalized decision", async () => {
  let state = createInitialState();
  const actions: PrototypeAction[] = [];
  const dispatch = (action: PrototypeAction) => {
    actions.push(action);
    state = reducer(state, action);
  };
  loginWithCredentials(state, dispatch, "test", "test");

  const ok = await generateVerificationRecord(state, dispatch, "missing-decision");

  assert.equal(ok, false);
  assert.equal(actions.some((action) => action.type === "SET_SIMULATED_ERROR"), true);
  assert.equal(state.verificationRecords.length, 0);
});

test("generateVerificationRecord creates verification from finalized decision", async () => {
  let state = createInitialState();
  const dispatch = (action: PrototypeAction) => {
    state = reducer(state, action);
  };

  loginWithCredentials(state, dispatch, "test", "test");
  uploadSampleFiles(state, dispatch);
  startAnalysisJob(state, dispatch);
  confirmCandidates(state, dispatch);
  const insightId = state.insights[0].id;
  createProposalFromInsight(state, dispatch, insightId);
  const proposalId = state.proposals[0].id;
  castVote(state, dispatch, proposalId, "approve", "매니저 테스트");
  finalizeProposal(state, dispatch, proposalId);

  const ok = await generateVerificationRecord(state, dispatch, state.decisions[0].id);

  assert.equal(ok, true);
  assert.equal(state.verificationRecords.length, 1);
  assert.equal(state.verificationRecords[0].hash.length, 64);
  assert.equal(state.verificationRecords[0].scopeHash.length, 64);
  assert.equal(state.verificationRecords[0].revision, 1);
  assert.equal(state.verificationRecords[0].verificationMethod, "xrpl_ready");
  assert.equal(state.verificationRecords[0].trustCertificationStatus, "pending");
  assert.equal(state.verificationRecords[0].canonicalJson.includes("selectionScopeHash"), true);

  const firstRecord = state.verificationRecords[0];
  state = {
    ...state,
    metricValues: state.metricValues.map((value, index) =>
      index === 0
        ? {
            ...value,
            series: [...value.series, { label: "검증 반영", value: value.value + 1 }],
            value: value.value + 1
          }
        : value
    )
  };
  const repeatedOk = await generateVerificationRecord(state, dispatch, state.decisions[0].id);

  assert.equal(repeatedOk, true);
  assert.equal(state.verificationRecords.length, 2);
  assert.equal(state.verificationRecords[0].revision, 2);
  assert.equal(state.verificationRecords[0].previousVerificationId, firstRecord.id);
  assert.notEqual(state.verificationRecords[0].scopeHash, firstRecord.scopeHash);
});
