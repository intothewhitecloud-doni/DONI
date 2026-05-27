import assert from "node:assert/strict";
import test from "node:test";
import { loginWithCredentials, logout, signup } from "../prototype/commands/authCommands";
import {
  addOrganizationCategory,
  approveCompanyUser,
  deleteCompanyUserAccount,
  deleteOrganizationCategory,
  regenerateCompanyCode,
  rejectCompanyUser,
  updateOrganizationCategory,
  updateCompanyProfile,
  updateCompanyUser
} from "../prototype/commands/organizationCommands";
import { addSourceFiles, uploadSampleFiles } from "../prototype/commands/fileCommands";
import { confirmCandidates, editCandidate, excludeCandidate } from "../prototype/commands/analysisCommands";
import { createProposalFromInsight } from "../prototype/commands/insightCommands";
import { castVote, finalizeProposal } from "../prototype/commands/proposalCommands";
import { commandMeta } from "../prototype/events";
import { createInitialState } from "../prototype/store";
import { companyUserStatusLabel, proposalStatusLabel } from "./policy";
import { reducer, type PrototypeAction } from "./state-machine";
import { UNASSIGNED_ORGANIZATION_CATEGORY_ID } from "./types";

function dispatchFor(stateRef: { state: ReturnType<typeof createInitialState> }) {
  return (action: PrototypeAction) => {
    stateRef.state = reducer(stateRef.state, action);
  };
}

test("initial service state is a single company console without operating data", () => {
  const state = createInitialState();

  assert.equal(state.screen, "home");
  assert.equal(state.company.id, "company-next-manufacturing");
  assert.equal(state.companyUsers.length, 2);
  assert.equal(state.companyUsers.every((companyUser) => companyUser.role === "owner" || companyUser.role === "manager"), true);
  assert.equal(state.sourceFiles.length, 0);
  assert.equal(state.entities.length, 0);
  for (const removedCollectionName of [["work", "spaces"].join(""), ["mem", "bers"].join("")]) {
    assert.equal(removedCollectionName in state, false);
  }
});

test("approved login enters dashboard and logout returns to login", () => {
  const stateRef = { state: createInitialState() };
  const dispatch = dispatchFor(stateRef);

  assert.equal(loginWithCredentials(stateRef.state, dispatch, "test", "test"), true);
  assert.equal(stateRef.state.session.loggedIn, true);
  assert.equal(stateRef.state.session.currentUserId, "user-manager");
  assert.equal(stateRef.state.session.role, "manager");
  assert.equal(stateRef.state.screen, "dashboard");

  logout(stateRef.state, dispatch);

  assert.equal(stateRef.state.session.loggedIn, false);
  assert.equal(stateRef.state.screen, "login");
});

test("signup requires company code and pending login stays on login with approval popup", () => {
  const stateRef = { state: createInitialState() };
  const dispatch = dispatchFor(stateRef);

  assert.equal(signup(stateRef.state, dispatch, { code: "", email: "new.user@example.com", name: "신규 사용자", password: "user-pass!" }), false);
  assert.match(stateRef.state.permissionDenied ?? "", /회사코드/);

  assert.equal(signup(stateRef.state, dispatch, { code: "DONI-NEXT-4821", email: "new.user@example.com", name: "신규 사용자", password: "user-pass!" }), true);
  const pending = stateRef.state.companyUsers.find((companyUser) => companyUser.email === "new.user@example.com");
  assert.ok(pending);
  assert.equal(pending.status, "pending");
  assert.equal(stateRef.state.screen, "login");
  assert.equal(stateRef.state.session.loggedIn, false);
  assert.match(stateRef.state.permissionDenied ?? "", /승인/);

  assert.equal(loginWithCredentials(stateRef.state, dispatch, "new.user@example.com", "user-pass!"), true);
  assert.equal(stateRef.state.screen, "login");
  assert.equal(stateRef.state.session.loggedIn, false);
  assert.match(stateRef.state.permissionDenied ?? "", /승인/);

  const fileCount = stateRef.state.sourceFiles.length;
  assert.equal(addSourceFiles(stateRef.state, dispatch, [{ name: "pending-upload.csv", size: 100, rowCount: 1 }]), false);
  assert.equal(stateRef.state.sourceFiles.length, fileCount);
});

test("owner can approve and reject company users while manager cannot mutate company administration", () => {
  const stateRef = { state: createInitialState() };
  const dispatch = dispatchFor(stateRef);

  loginWithCredentials(stateRef.state, dispatch, "owner01", "owner01!");
  signup(stateRef.state, dispatch, { code: "DONI-NEXT-4821", email: "pending.user@example.com", name: "대기 사용자", password: "pending-pass!" });
  loginWithCredentials(stateRef.state, dispatch, "owner01", "owner01!");

  const pending = stateRef.state.companyUsers.find((companyUser) => companyUser.email === "pending.user@example.com");
  assert.ok(pending);
  assert.equal(approveCompanyUser(stateRef.state, dispatch, pending.id), true);
  assert.equal(stateRef.state.companyUsers.find((companyUser) => companyUser.id === pending.id)?.status, "active");

  loginWithCredentials(stateRef.state, dispatch, "test", "test");
  const beforeName = stateRef.state.company.name;
  const beforeCode = stateRef.state.company.code;
  assert.equal(updateCompanyProfile(stateRef.state, dispatch, { name: "무단 변경" }), false);
  assert.equal(regenerateCompanyCode(stateRef.state, dispatch), false);
  assert.equal(stateRef.state.company.name, beforeName);
  assert.equal(stateRef.state.company.code, beforeCode);
});

test("privileged company reducers require an active owner session", () => {
  const stateRef = { state: createInitialState() };
  const dispatch = dispatchFor(stateRef);
  loginWithCredentials(stateRef.state, dispatch, "test", "test");

  const beforeName = stateRef.state.company.name;
  const beforeCode = stateRef.state.company.code;
  const beforeCategoryIds = stateRef.state.organizationCategories.map((category) => category.id);
  const beforeTypeCount = stateRef.state.managedObjectTypes.length;

  dispatch({ type: "UPDATE_COMPANY", name: "무단 변경" });
  dispatch({ type: "REGENERATE_COMPANY_CODE", code: "BYPASS-0000" });
  dispatch({ type: "ADD_ORGANIZATION_CATEGORY", name: "무단 조직" });
  dispatch({ type: "UPDATE_ORGANIZATION_CATEGORY", organizationCategoryId: UNASSIGNED_ORGANIZATION_CATEGORY_ID, name: "무단 수정" });
  dispatch({ type: "DELETE_ORGANIZATION_CATEGORY", organizationCategoryId: UNASSIGNED_ORGANIZATION_CATEGORY_ID });
  dispatch({ type: "ADD_DOMAIN_TYPE", scope: "managed_object", label: "무단 유형" });

  assert.equal(stateRef.state.company.name, beforeName);
  assert.equal(stateRef.state.company.code, beforeCode);
  assert.deepEqual(stateRef.state.organizationCategories.map((category) => category.id), beforeCategoryIds);
  assert.equal(stateRef.state.managedObjectTypes.length, beforeTypeCount);
  assert.match(stateRef.state.permissionDenied ?? "", /기업 정보를 변경/);
});

test("company user update supports title and organization category assignment", () => {
  const stateRef = { state: createInitialState() };
  const dispatch = dispatchFor(stateRef);
  loginWithCredentials(stateRef.state, dispatch, "owner01", "owner01!");

  const target = stateRef.state.companyUsers.find((companyUser) => companyUser.userId === "user-manager");
  assert.ok(target);
  assert.equal(addOrganizationCategory(stateRef.state, dispatch, "품질"), true);
  const category = stateRef.state.organizationCategories.find((item) => item.name === "품질");
  assert.ok(category);
  assert.equal(
    updateCompanyUser(stateRef.state, dispatch, {
      companyUserId: target.id,
      role: "manager",
      title: "품질 리드",
      organizationCategoryId: category.id
    }),
    true
  );

  const updated = stateRef.state.companyUsers.find((companyUser) => companyUser.id === target.id);
  assert.equal(updated?.title, "품질 리드");
  assert.equal(updated?.organizationCategoryId, category.id);
});

test("organization category deletion moves users and files to unassigned", () => {
  const stateRef = { state: createInitialState() };
  const dispatch = dispatchFor(stateRef);
  loginWithCredentials(stateRef.state, dispatch, "owner01", "owner01!");
  addOrganizationCategory(stateRef.state, dispatch, "물류");
  addOrganizationCategory(stateRef.state, dispatch, "품질");
  const category = stateRef.state.organizationCategories.find((item) => item.name === "물류");
  const duplicateCategory = stateRef.state.organizationCategories.find((item) => item.name === "품질");
  assert.ok(category);
  assert.ok(duplicateCategory);
  assert.equal(updateOrganizationCategory(stateRef.state, dispatch, category.id, duplicateCategory.name), false);
  assert.equal(stateRef.state.organizationCategories.find((item) => item.id === category.id)?.name, "물류");
  assert.match(stateRef.state.permissionDenied ?? "", /이미 등록된 조직/);

  const manager = stateRef.state.companyUsers.find((companyUser) => companyUser.userId === "user-manager");
  assert.ok(manager);
  updateCompanyUser(stateRef.state, dispatch, {
    companyUserId: manager.id,
    role: "manager",
    title: manager.title,
    organizationCategoryId: category.id
  });
  addSourceFiles(
    stateRef.state,
    dispatch,
    [{ name: "물류_리드타임.csv", size: 100, rowCount: 10 }],
    category.id
  );

  assert.equal(stateRef.state.sourceFiles[0].organizationCategoryId, category.id);
  assert.equal(deleteOrganizationCategory(stateRef.state, dispatch, category.id), true);
  assert.equal(stateRef.state.companyUsers.find((companyUser) => companyUser.id === manager.id)?.organizationCategoryId, UNASSIGNED_ORGANIZATION_CATEGORY_ID);
  assert.equal(stateRef.state.sourceFiles[0].organizationCategoryId, UNASSIGNED_ORGANIZATION_CATEGORY_ID);
});

test("deleting a company user removes the account but preserves historical actor snapshots", () => {
  const stateRef = { state: createInitialState() };
  const dispatch = dispatchFor(stateRef);
  loginWithCredentials(stateRef.state, dispatch, "owner01", "owner01!");
  stateRef.state = {
    ...stateRef.state,
    auditLogs: [
      {
        id: "audit-manager-historical",
        action: "과거 기록",
        actorId: "user-manager",
        at: "2026-05-07T09:00:00.000Z",
        summary: "삭제 전 사용자 이름 스냅샷 보존 테스트",
        targetId: "probe",
        targetType: "audit_probe"
      },
      ...stateRef.state.auditLogs
    ],
    decisions: [
      {
        id: "decision-legacy-missing-snapshot",
        finalizedAt: "2026-05-07T09:00:00.000Z",
        proposalId: "proposal-legacy",
        result: "approved",
        summary: "삭제 대상과 관계없는 레거시 결정",
        title: "레거시 결정"
      },
      {
        id: "decision-owner-snapshot",
        actorSnapshot: { name: "박민재", role: "owner", userId: "user-owner" },
        finalizedAt: "2026-05-07T09:10:00.000Z",
        proposalId: "proposal-owner",
        result: "approved",
        summary: "소유자가 확정한 결정",
        title: "소유자 결정"
      },
      ...stateRef.state.decisions
    ],
    outcomes: [
      {
        id: "outcome-legacy-missing-snapshot",
        afterMetricValue: 2,
        beforeMetricValue: 1,
        decisionId: "decision-legacy-missing-snapshot",
        recordedAt: "2026-05-07T10:00:00.000Z",
        status: "recorded",
        summary: "삭제 대상과 관계없는 레거시 결과"
      },
      ...stateRef.state.outcomes
    ],
    proposals: [
      {
        id: "proposal-unrelated-owner-only",
        comments: [],
        createdAt: "2026-05-07T08:00:00.000Z",
        deadline: "2026-05-14T08:00:00.000Z",
        expectedImpact: "레거시 제안 보존",
        insightId: "insight-owner-only",
        status: "voting",
        summary: "삭제 대상과 관계없는 소유자 전용 제안",
        title: "소유자 전용 제안",
        voterUserIds: ["user-owner"],
        votingRule: { allowAbstain: true, allowVoteChange: true, approvalPercent: 50, quorumPercent: 50, tieBreakerRole: "owner" }
      },
      {
        id: "proposal-manager-voter",
        comments: [],
        createdAt: "2026-05-07T08:30:00.000Z",
        deadline: "2026-05-14T08:30:00.000Z",
        expectedImpact: "삭제 사용자 투표권 보존",
        insightId: "insight-manager-voter",
        status: "voting",
        summary: "삭제 대상이 투표자인 제안",
        title: "관리자 투표 제안",
        voterUserIds: ["user-manager"],
        votingRule: { allowAbstain: true, allowVoteChange: true, approvalPercent: 50, quorumPercent: 50, tieBreakerRole: "owner" }
      },
      ...stateRef.state.proposals
    ]
  };
  const target = stateRef.state.companyUsers.find((companyUser) => companyUser.userId === "user-manager");
  assert.ok(target);

  assert.equal(deleteCompanyUserAccount(stateRef.state, dispatch, target.id), true);
  assert.equal(stateRef.state.users.some((user) => user.id === "user-manager"), false);
  assert.equal(stateRef.state.authAccounts.some((account) => account.userId === "user-manager"), false);
  assert.equal(stateRef.state.companyUsers.some((companyUser) => companyUser.userId === "user-manager"), false);
  assert.equal(stateRef.state.auditLogs.some((log) => log.actorSnapshot?.name === "김도현"), true);
  assert.equal(stateRef.state.decisions.find((decision) => decision.id === "decision-legacy-missing-snapshot")?.actorSnapshot, undefined);
  assert.equal(stateRef.state.decisions.find((decision) => decision.id === "decision-owner-snapshot")?.actorSnapshot?.name, "박민재");
  assert.equal(stateRef.state.outcomes.find((outcome) => outcome.id === "outcome-legacy-missing-snapshot")?.actorSnapshot, undefined);
  assert.equal(stateRef.state.proposals.find((proposal) => proposal.id === "proposal-unrelated-owner-only")?.voterSnapshots, undefined);
  assert.equal(stateRef.state.proposals.find((proposal) => proposal.id === "proposal-manager-voter")?.voterSnapshots?.[0]?.name, "김도현");
});

test("data flow can upload, confirm candidates, create proposal, vote, and finalize", () => {
  const stateRef = { state: createInitialState() };
  const dispatch = dispatchFor(stateRef);
  loginWithCredentials(stateRef.state, dispatch, "test", "test");

  assert.equal(uploadSampleFiles(stateRef.state, dispatch), true);
  assert.equal(stateRef.state.candidates.length > 0, true);
  editCandidate(stateRef.state, dispatch, "candidate-customer", "핵심 고객군 보정", "테스트 보정");
  excludeCandidate(stateRef.state, dispatch, "candidate-claim-flow");
  confirmCandidates(stateRef.state, dispatch);
  const insightId = stateRef.state.insights[0].id;
  createProposalFromInsight(stateRef.state, dispatch, insightId);
  const proposalId = stateRef.state.proposals[0].id;
  castVote(stateRef.state, dispatch, proposalId, "approve", "기업 관리자 테스트");
  finalizeProposal(stateRef.state, dispatch, proposalId);

  assert.equal(stateRef.state.analysisJobs[0].status, "completed");
  assert.equal(stateRef.state.proposals[0].status, "finalized");
  assert.equal(stateRef.state.decisions.length, 1);
});

test("labels use company terminology", () => {
  assert.equal(companyUserStatusLabel("pending"), "승인 대기");
  assert.equal(companyUserStatusLabel("active"), "승인 완료");
  assert.equal(proposalStatusLabel("voting"), "투표 중");
});
