import assert from "node:assert/strict";
import test from "node:test";
import { loginWithCredentials, logout } from "../prototype/commands/authCommands";
import { joinWorkspaceByInviteCode } from "../prototype/commands/workspaceCommands";
import {
  activateWorkspaceMember,
  deactivateWorkspaceMember,
  regenerateInviteCode,
  updateWorkspaceMember,
  updateWorkspaceProfile
} from "../prototype/commands/organizationCommands";
import { commandMeta } from "../prototype/events";
import { getDashboardView } from "../prototype/queries/dashboardQueries";
import { getManagedObjectGraphItemDetail, getManagedObjectView } from "../prototype/queries/managedObjectQueries";
import { createInitialState } from "../prototype/store";
import { currentWorkspaceData, reducer, SOLE_ADMIN_LEAVE_BLOCKED_MESSAGE, type PrototypeAction } from "./state-machine";
import { displayTypeLabel, normalizeDomainTypeCatalog, normalizeTypeColor } from "./type-catalog";

function audited(state: ReturnType<typeof createInitialState>, action: PrototypeAction, label: string, targetType: string, targetId: string): PrototypeAction {
  return { ...action, ...commandMeta(state, label, targetType, targetId, `${label} 테스트`) };
}

test("initial service state starts empty before upload and analysis", () => {
  const state = createInitialState();

  assert.equal(state.screen, "home");
  assert.equal(state.sourceFiles.length, 0);
  assert.equal(state.entities.length, 0);
  assert.equal(state.events.length, 0);
  assert.equal(state.relations.length, 0);
  assert.equal(state.metricDefinitions.length, 0);
  assert.equal(state.insights.length, 0);
});

test("upload creates uploaded files, analysis job, and audit trail", () => {
  const initial = createInitialState();
  const uploaded = reducer(initial, audited(initial, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-orders"));
  const analyzed = reducer(uploaded, {
    type: "START_ANALYSIS",
    ...commandMeta(uploaded, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });

  assert.equal(uploaded.sourceFiles.every((file) => file.status === "uploaded"), true);
  assert.equal(analyzed.analysisJobs.length, 1);
  assert.equal(analyzed.candidates.length > 0, true);
  assert.equal(analyzed.evidence.every((evidence) => evidence.sourceKind === "canonical_sample"), true);
  assert.equal(analyzed.evidence.every((evidence) => evidence.analysisSourceId === "public-sample-2026-05-11"), true);
  assert.equal(analyzed.evidence.some((evidence) => evidence.rowNumbers && evidence.rowNumbers.length > 0), true);
  assert.equal(analyzed.auditLogs.some((log) => log.action === "인공지능 분석 시작"), true);
});

test("domain type catalog normalizes legacy and invalid colors", () => {
  const normalized = normalizeDomainTypeCatalog(
    [
      { id: "managed-type-legacy", scope: "managed_object", label: "고객군" } as never,
      { id: "managed-type-invalid", scope: "managed_object", label: "공급사", color: "rainbow" } as never
    ],
    "managed_object"
  );

  assert.equal(normalized[0]?.color, "blue");
  assert.equal(normalized[1]?.color, "slate");
  assert.equal(normalizeTypeColor("emerald"), "emerald");
  assert.equal(normalizeTypeColor("not-a-token"), "slate");
});

test("role is selected by login account and logout returns to login", () => {
  let state = createInitialState();
  const dispatch = (action: PrototypeAction) => {
    state = reducer(state, action);
  };

  assert.equal(loginWithCredentials(state, dispatch, "member01", "member01!"), true);
  assert.equal(state.session.loggedIn, true);
  assert.equal(state.session.currentUserId, "user-member");
  assert.equal(state.session.role, "member");
  assert.equal(state.screen, "workspace");

  logout(state, dispatch);

  assert.equal(state.session.loggedIn, false);
  assert.equal(state.screen, "login");
});

test("data vault can add files before upload", () => {
  const initial = createInitialState();
  const added = reducer(
    initial,
    audited(
      initial,
      {
        type: "ADD_SOURCE_FILES",
        files: [
          {
            id: "source-added-orders",
            name: "추가_주문_기록.xlsx",
            kind: "표 형식 데이터",
            rowCount: 120,
            status: "ready",
            dataUrl: "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,dGVzdA==",
            previewColumns: ["주문번호", "상태"],
            previewRows: [["O-1", "정상"]]
          }
        ]
      },
      "파일 추가",
      "source_file",
      "source-added-orders"
    )
  );
  const uploaded = reducer(added, audited(added, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-added-orders"));

  assert.equal(added.screen, "vault");
  assert.equal(added.sourceFiles[0].name, "추가_주문_기록.xlsx");
  assert.equal(added.sourceFiles[0].status, "ready");
  assert.deepEqual(added.sourceFiles[0].previewRows, [["O-1", "정상"]]);
  assert.equal(uploaded.sourceFiles[0].status, "uploaded");
});

test("data vault can update and remove added files", () => {
  const initial = createInitialState();
  const added = reducer(
    initial,
    audited(
      initial,
      {
        type: "ADD_SOURCE_FILES",
        files: [
          {
            id: "source-added-margin",
            name: "상품별_마진_공급사.csv",
            kind: "표 형식 데이터",
            rowCount: 8,
            status: "ready"
          }
        ]
      },
      "파일 추가",
      "source_file",
      "source-added-margin"
    )
  );
  const updated = reducer(
    added,
    audited(
      added,
      {
        type: "UPDATE_SOURCE_FILE",
        fileId: "source-added-margin",
        patch: { name: "상품별_마진_공급사_수정.csv", kind: "업무 파일" }
      },
      "파일 정보 수정",
      "source_file",
      "source-added-margin"
    )
  );
  const removed = reducer(
    updated,
    audited(updated, { type: "REMOVE_SOURCE_FILE", fileId: "source-added-margin" }, "파일 제거", "source_file", "source-added-margin")
  );

  assert.equal(updated.sourceFiles[0].name, "상품별_마진_공급사_수정.csv");
  assert.equal(updated.sourceFiles[0].kind, "업무 파일");
  assert.equal(removed.sourceFiles.length, 0);
});

test("analyzed files can be removed without deleting the confirmed operating frame", () => {
  const initial = createInitialState();
  const added = reducer(
    initial,
    audited(
      initial,
      {
        type: "ADD_SOURCE_FILES",
        files: [
          {
            id: "source-analyzed-orders",
            name: "분석된_주문_기록.xlsx",
            kind: "표 형식 데이터",
            rowCount: 24,
            status: "ready"
          }
        ]
      },
      "파일 추가",
      "source_file",
      "source-analyzed-orders"
    )
  );
  const uploaded = reducer(added, audited(added, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-analyzed-orders"));
  const analyzed = reducer(uploaded, {
    type: "START_ANALYSIS",
    ...commandMeta(uploaded, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });
  const removed = reducer(
    analyzed,
    audited(analyzed, { type: "REMOVE_SOURCE_FILE", fileId: "source-analyzed-orders" }, "파일 제거", "source_file", "source-analyzed-orders")
  );

  assert.equal(analyzed.sourceFiles[0].status, "parsed");
  assert.equal(analyzed.evidence.every((evidence) => evidence.sourceKind === "canonical_sample"), true);
  assert.equal(analyzed.evidence.every((evidence) => evidence.sourceFileId !== "source-analyzed-orders"), true);
  assert.equal(analyzed.analysisJobs.length, 1);
  assert.equal(analyzed.candidates.length > 0, true);
  const confirmed = reducer(
    analyzed,
    audited(analyzed, { type: "CONFIRM_CANDIDATES" }, "데이터 구조 확정", "workspace", analyzed.session.workspaceId)
  );
  const removedAfterConfirm = reducer(
    confirmed,
    audited(confirmed, { type: "REMOVE_SOURCE_FILE", fileId: "source-analyzed-orders" }, "파일 제거", "source_file", "source-analyzed-orders")
  );

  assert.equal(removed.sourceFiles.length, 0);
  assert.equal(removed.analysisJobs.length, 1);
  assert.equal(removed.candidates.length > 0, true);
  assert.equal(removed.entities.length, 0);
  assert.equal(removedAfterConfirm.sourceFiles.length, 0);
  assert.equal(removedAfterConfirm.entities.length, confirmed.entities.length);
  assert.equal(removedAfterConfirm.events.length, confirmed.events.length);
  assert.equal(removedAfterConfirm.relations.length, confirmed.relations.length);
  assert.equal(removedAfterConfirm.metricDefinitions.length, confirmed.metricDefinitions.length);
  assert.equal(removedAfterConfirm.insights.length, confirmed.insights.length);
});

test("existing member workspace selection enters dashboard without company setup", () => {
  const initial = createInitialState();
  const selected = reducer(
    initial,
    audited(initial, { type: "SELECT_WORKSPACE", workspaceId: "workspace-next-manufacturing" }, "워크스페이스 선택", "workspace", "workspace-next-manufacturing")
  );

  assert.equal(selected.screen, "dashboard");
  assert.equal(selected.session.workspaceId, "workspace-next-manufacturing");
  assert.equal(selected.company.name, "넥스트 제조 그룹");
  assert.equal(selected.company.dataReadiness, "ready");
});

test("non-member workspace selection is denied", () => {
  const initial = createInitialState();
  const selected = reducer(
    initial,
    audited(initial, { type: "SELECT_WORKSPACE", workspaceId: "workspace-health-supply" }, "워크스페이스 선택", "workspace", "workspace-health-supply")
  );

  assert.equal(selected.screen, "workspace");
  assert.equal(selected.session.workspaceId, "workspace-next-manufacturing");
  assert.equal(selected.permissionDenied, "현재 사용자는 해당 그룹에 속해 있지 않습니다.");
});

test("workspace switching keeps operational data scoped to the selected group", () => {
  const initial = createInitialState();
  const added = reducer(
    initial,
    audited(
      initial,
      {
        type: "ADD_SOURCE_FILES",
        files: [
          {
            id: "source-next-only",
            name: "넥스트_전용_파일.csv",
            kind: "표 형식 데이터",
            rowCount: 12,
            status: "ready"
          }
        ]
      },
      "파일 추가",
      "source_file",
      "source-next-only"
    )
  );
  const analyzed = reducer(added, {
    type: "START_ANALYSIS",
    ...commandMeta(added, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });
  const confirmed = reducer(
    analyzed,
    audited(analyzed, { type: "CONFIRM_CANDIDATES" }, "데이터 구조 확정", "workspace", analyzed.session.workspaceId)
  );
  const createdWorkspace = reducer(
    confirmed,
    audited(
      confirmed,
      { type: "CREATE_WORKSPACE", name: "신규 격리 그룹", industry: "B2B 서비스", goal: "새 그룹 데이터 격리 확인" },
      "워크스페이스 생성",
      "workspace",
      confirmed.session.workspaceId
    )
  );
  const switched = reducer(
    createdWorkspace,
    audited(createdWorkspace, { type: "SELECT_WORKSPACE", workspaceId: createdWorkspace.workspaces[0].id }, "워크스페이스 선택", "workspace", createdWorkspace.workspaces[0].id)
  );
  const switchedBack = reducer(
    switched,
    audited(switched, { type: "SELECT_WORKSPACE", workspaceId: "workspace-next-manufacturing" }, "워크스페이스 선택", "workspace", "workspace-next-manufacturing")
  );

  assert.equal(switched.sourceFiles.length, 0);
  assert.equal(switched.entities.length, 0);
  assert.equal(currentWorkspaceData(switched).sourceFiles.length, 0);
  assert.equal(switched.workspaceDataById["workspace-next-manufacturing"].sourceFiles[0].name, "넥스트_전용_파일.csv");
  assert.equal(switched.workspaceDataById["workspace-next-manufacturing"].entities.length > 0, true);
  assert.equal(switchedBack.sourceFiles[0].name, "넥스트_전용_파일.csv");
  assert.equal(switchedBack.entities.length > 0, true);
});

test("new workspace creation adds a selectable workspace before entering it", () => {
  const initial = createInitialState();
  const created = reducer(
    initial,
    audited(
      initial,
      { type: "CREATE_WORKSPACE", name: "신규 운영 조직", industry: "B2B 서비스", goal: "고객 이탈 징후를 조기에 발견" },
      "워크스페이스 생성",
      "workspace",
      initial.session.workspaceId
    )
  );
  const selected = reducer(
    created,
    audited(created, { type: "SELECT_WORKSPACE", workspaceId: created.workspaces[0].id }, "워크스페이스 선택", "workspace", created.workspaces[0].id)
  );

  assert.equal(created.screen, "workspace");
  assert.equal(created.workspaces[0].name, "신규 운영 조직");
  assert.equal(created.members[0].role, "admin");
  assert.notEqual(created.session.workspaceId, created.workspaces[0].id);
  assert.equal(created.entities.length, 0);
  assert.equal(created.events.length, 0);
  assert.equal(selected.screen, "dashboard");
  assert.equal(selected.company.name, "신규 운영 조직");
  assert.equal(selected.session.workspaceId, created.workspaces[0].id);
  assert.equal(selected.session.role, "admin");
});

test("invite code joins the current user to the target workspace", () => {
  let state = createInitialState();
  const dispatch = (action: PrototypeAction) => {
    state = reducer(state, action);
  };

  assert.equal(joinWorkspaceByInviteCode(state, dispatch, "DONI-HEALTH-9174"), true);

  assert.equal(state.session.workspaceId, "workspace-health-supply");
  assert.equal(state.session.role, "member");
  assert.equal(state.screen, "dashboard");
  assert.equal(
    state.members.some(
      (member) =>
        member.userId === state.session.currentUserId &&
        member.workspaceId === "workspace-health-supply" &&
        member.role === "member" &&
        member.status === "active"
    ),
    true
  );
});

test("last active workspace member leave deletes workspace and group data", () => {
  const initial = createInitialState();
  const created = reducer(
    initial,
    audited(
      initial,
      { type: "CREATE_WORKSPACE", name: "이탈 테스트 그룹", industry: "B2B 서비스", goal: "나가기 동작 확인" },
      "워크스페이스 생성",
      "workspace",
      initial.session.workspaceId
    )
  );
  const selected = reducer(
    created,
    audited(created, { type: "SELECT_WORKSPACE", workspaceId: created.workspaces[0].id }, "워크스페이스 선택", "workspace", created.workspaces[0].id)
  );
  const workspaceId = created.workspaces[0].id;
  const left = reducer(
    selected,
    audited(selected, { type: "LEAVE_WORKSPACE", workspaceId }, "워크스페이스 나가기", "workspace", workspaceId)
  );

  assert.equal(left.screen, "workspace");
  assert.equal(left.session.workspaceId, "workspace-next-manufacturing");
  assert.equal(left.workspaces.some((workspace) => workspace.id === workspaceId), false);
  assert.equal(left.members.some((member) => member.workspaceId === workspaceId), false);
  assert.equal(Boolean(left.workspaceDataById[workspaceId]), false);
});

test("sole workspace admin cannot leave while active members remain before succession", () => {
  const initial = createInitialState();
  const created = reducer(
    initial,
    audited(
      initial,
      { type: "CREATE_WORKSPACE", name: "승계 필요 그룹", industry: "B2B 서비스", goal: "관리자 고아 상태 방지" },
      "워크스페이스 생성",
      "workspace",
      initial.session.workspaceId
    )
  );
  const selected = reducer(
    created,
    audited(created, { type: "SELECT_WORKSPACE", workspaceId: created.workspaces[0].id }, "워크스페이스 선택", "workspace", created.workspaces[0].id)
  );
  const workspaceId = created.workspaces[0].id;
  const withMember = {
    ...selected,
    members: [
      {
        eligibleVoter: true,
        id: "member-remaining-member",
        name: "이하린",
        role: "member" as const,
        status: "active" as const,
        title: "공급망 담당",
        userId: "user-member",
        workspaceId
      },
      ...selected.members
    ]
  };
  const blocked = reducer(
    withMember,
    audited(withMember, { type: "LEAVE_WORKSPACE", workspaceId }, "워크스페이스 나가기", "workspace", workspaceId)
  );

  assert.equal(blocked.session.workspaceId, workspaceId);
  assert.equal(blocked.workspaces.some((workspace) => workspace.id === workspaceId), true);
  assert.equal(blocked.members.find((member) => member.workspaceId === workspaceId && member.userId === "user-manager")?.status, "active");
  assert.equal(blocked.permissionDenied, SOLE_ADMIN_LEAVE_BLOCKED_MESSAGE);
});

test("workspace admin can leave after admin succession without deleting group data", () => {
  const initial = createInitialState();
  const created = reducer(
    initial,
    audited(
      initial,
      { type: "CREATE_WORKSPACE", name: "승계 테스트 그룹", industry: "B2B 서비스", goal: "승계 후 나가기 동작 확인" },
      "워크스페이스 생성",
      "workspace",
      initial.session.workspaceId
    )
  );
  const selected = reducer(
    created,
    audited(created, { type: "SELECT_WORKSPACE", workspaceId: created.workspaces[0].id }, "워크스페이스 선택", "workspace", created.workspaces[0].id)
  );
  const withSuccessor = {
    ...selected,
    members: [
      {
        eligibleVoter: true,
        id: "member-successor-admin",
        name: "박민재",
        role: "admin" as const,
        status: "active" as const,
        title: "전략기획 관리자",
        userId: "user-admin",
        workspaceId: created.workspaces[0].id
      },
      ...selected.members
    ]
  };
  const left = reducer(
    withSuccessor,
    audited(withSuccessor, { type: "LEAVE_WORKSPACE", workspaceId: created.workspaces[0].id }, "워크스페이스 나가기", "workspace", created.workspaces[0].id)
  );

  assert.equal(left.screen, "workspace");
  assert.equal(left.session.workspaceId, "workspace-next-manufacturing");
  assert.equal(left.members.find((member) => member.workspaceId === created.workspaces[0].id && member.userId === "user-manager")?.status, "inactive");
  assert.equal(left.members.find((member) => member.id === "member-successor-admin")?.status, "active");
  assert.ok(left.workspaceDataById[created.workspaces[0].id]);
});

test("role switch reprojects to the selected user's accessible workspace", () => {
  const initial = createInitialState();
  const created = reducer(
    initial,
    audited(
      initial,
      { type: "CREATE_WORKSPACE", name: "관리자 전용 그룹", industry: "B2B 서비스", goal: "관리자 전용 데이터 격리 확인" },
      "워크스페이스 생성",
      "workspace",
      initial.session.workspaceId
    )
  );
  const selected = reducer(
    created,
    audited(created, { type: "SELECT_WORKSPACE", workspaceId: created.workspaces[0].id }, "워크스페이스 선택", "workspace", created.workspaces[0].id)
  );
  const switched = reducer(selected, { type: "SET_ROLE", role: "member" });

  assert.equal(selected.session.currentUserId, "user-manager");
  assert.equal(selected.session.workspaceId, created.workspaces[0].id);
  assert.equal(switched.session.currentUserId, "user-member");
  assert.equal(switched.session.workspaceId, "workspace-next-manufacturing");
});

test("organization management updates group profile, invite code, and existing users", () => {
  let state = createInitialState();
  const dispatch = (action: PrototypeAction) => {
    state = reducer(state, action);
  };

  loginWithCredentials(state, dispatch, "admin01", "admin01!");

  assert.equal(
    updateWorkspaceProfile(state, dispatch, {
      goal: "핵심 고객 이탈 위험을 조기에 파악",
      industry: "B2B SaaS",
      name: "DONI 운영 그룹",
      workspaceId: "workspace-next-manufacturing"
    }),
    true
  );
  assert.equal(state.workspaces[0].name, "DONI 운영 그룹");
  assert.equal(state.company.name, "DONI 운영 그룹");

  const beforeCode = state.workspaces[0].inviteCode;
  assert.equal(regenerateInviteCode(state, dispatch, "workspace-next-manufacturing"), true);
  assert.notEqual(state.workspaces[0].inviteCode, beforeCode);

  const member = state.members.find((item) => item.userId === "user-member");
  assert.ok(member);

  assert.equal(updateWorkspaceMember(state, dispatch, { eligibleVoter: false, memberId: member.id, role: "manager", title: "영업 운영 리드" }), true);
  const promoted = state.members.find((item) => item.id === member.id);
  assert.equal(promoted?.role, "manager");
  assert.equal(promoted?.eligibleVoter, false);

  assert.equal(deactivateWorkspaceMember(state, dispatch, member.id), true);
  const inactive = state.members.find((item) => item.id === member.id);
  assert.equal(inactive?.status, "inactive");
  assert.equal(inactive?.eligibleVoter, false);

  assert.equal(activateWorkspaceMember(state, dispatch, member.id), true);
  const active = state.members.find((item) => item.id === member.id);
  assert.equal(active?.status, "active");
  assert.equal(active?.eligibleVoter, true);
});

test("non-admin users cannot mutate organization management", () => {
  let state = createInitialState();
  const dispatch = (action: PrototypeAction) => {
    state = reducer(state, action);
  };

  loginWithCredentials(state, dispatch, "test", "test");

  assert.equal(
    updateWorkspaceProfile(state, dispatch, {
      goal: "권한 없는 수정",
      industry: "B2B",
      name: "권한 없는 그룹",
      workspaceId: "workspace-next-manufacturing"
    }),
    false
  );
  assert.equal(state.workspaces[0].name, "넥스트 제조 그룹");
  assert.equal(state.permissionDenied, "현재 역할은 그룹 정보를 관리할 수 없습니다.");
});

test("restored shared workspace state keeps group data and switches to the login user", () => {
  const initial = createInitialState();
  const savedBase = createInitialState();
  const sourceFile = {
    id: "source-workspace-file",
    kind: "표 형식 데이터",
    name: "그룹_공유_업무파일.csv",
    rowCount: 3,
    status: "ready" as const
  };
  const vote = {
    choice: "approve" as const,
    id: "vote-user-manager",
    proposalId: "proposal-margin-delay",
    reason: "그룹 저장 테스트",
    votedAt: "2026-05-08T09:00:00.000Z",
    voterId: "user-manager"
  };
  const saved = {
    ...savedBase,
    screen: "proposalVote" as const,
    session: {
      currentUserId: "user-manager",
      loggedIn: true,
      role: "manager" as const,
      workspaceId: "workspace-next-manufacturing"
    },
    workspaceDataById: {
      ...savedBase.workspaceDataById,
      "workspace-next-manufacturing": {
        ...savedBase.workspaceDataById["workspace-next-manufacturing"],
        sourceFiles: [sourceFile],
        votes: [vote]
      }
    }
  };
  const restored = reducer(initial, {
    type: "RESTORE_USER_STATE",
    role: "member",
    screen: "dashboard",
    state: saved,
    userId: "user-member"
  });

  assert.equal(restored.screen, "dashboard");
  assert.equal(restored.session.currentUserId, "user-member");
  assert.equal(restored.session.role, "member");
  assert.equal(restored.session.loggedIn, true);
  assert.equal(restored.sourceFiles[0].name, "그룹_공유_업무파일.csv");
  assert.equal(restored.votes[0].reason, "그룹 저장 테스트");
  assert.equal(restored.workspaces[0].name, "넥스트 제조 그룹");
});

test("confirm candidates preserves evidence and creates confirmed operational state", () => {
  const initial = createInitialState();
  const uploaded = reducer(initial, audited(initial, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-orders"));
  const analyzed = reducer(uploaded, {
    type: "START_ANALYSIS",
    ...commandMeta(uploaded, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });
  const confirmed = reducer(
    analyzed,
    audited(analyzed, { type: "CONFIRM_CANDIDATES" }, "데이터 구조 확정", "workspace", analyzed.session.workspaceId)
  );

  assert.equal(confirmed.candidates.some((candidate) => candidate.status === "confirmed"), true);
  assert.equal(confirmed.candidates.every((candidate) => candidate.evidenceIds.length > 0), true);
  assert.equal(confirmed.entities.length > 0, true);
  assert.equal(confirmed.events.length > 0, true);
  assert.equal(confirmed.relations.length > 0, true);
  assert.equal(confirmed.metricDefinitions.length > 0, true);
  assert.equal(confirmed.relations.every((relation) => typeof relation.confidence === "number" && relation.metricIds && relation.metricIds.length > 0), true);
  assert.equal(confirmed.metricValues.every((metricValue) => metricValue.basis && Object.keys(metricValue.basis).length > 0), true);
  assert.equal(confirmed.insights.every((insight) => insight.supportSummary && insight.supportSummary.length >= 2), true);
});

test("confirm selected candidates keeps multiple managed objects and filters related operational data", () => {
  const initial = createInitialState();
  const uploaded = reducer(initial, audited(initial, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-orders"));
  const analyzed = reducer(uploaded, {
    type: "START_ANALYSIS",
    ...commandMeta(uploaded, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });
  const confirmed = reducer(
    analyzed,
    audited(
      analyzed,
      {
        type: "CONFIRM_CANDIDATES",
        selectedCandidateIds: [
          "candidate-customer",
          "candidate-supplier",
          "candidate-flow",
          "candidate-claim-flow",
          "candidate-relation",
          "candidate-relation-customer-claim",
          "candidate-metric-delay",
          "candidate-metric-claim"
        ]
      },
      "데이터 구조 확정",
      "workspace",
      analyzed.session.workspaceId
    )
  );

  assert.deepEqual(confirmed.selection?.selectedManagedCandidateIds, ["candidate-customer", "candidate-supplier"]);
  assert.deepEqual(confirmed.scope?.candidateProvenance["candidate-flow"], ["candidate-customer", "candidate-supplier"]);
  assert.deepEqual(confirmed.entities.map((entity) => entity.kind), ["고객군", "고객군", "고객군", "공급사", "공급사"]);
  assert.deepEqual(confirmed.events.map((event) => event.id), ["event-order", "event-outbound", "event-delivery", "event-claim", "event-compensation"]);
  assert.deepEqual(confirmed.metricDefinitions.map((metric) => metric.id), ["metric-delay-time", "metric-claim-rate"]);
  assert.equal(confirmed.workflowMetricBindings.length, 4);
  assert.equal(confirmed.candidates.find((candidate) => candidate.id === "candidate-customer")?.status, "confirmed");
  assert.equal(confirmed.candidates.find((candidate) => candidate.id === "candidate-supplier")?.status, "confirmed");
  assert.equal(confirmed.candidates.find((candidate) => candidate.id === "candidate-product-group")?.status, "excluded");
});

test("confirm candidates blocks a workflow when no selected metric can measure it", () => {
  const initial = createInitialState();
  const uploaded = reducer(initial, audited(initial, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-orders"));
  const analyzed = reducer(uploaded, {
    type: "START_ANALYSIS",
    ...commandMeta(uploaded, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });
  const blocked = reducer(
    analyzed,
    audited(
      analyzed,
      {
        type: "CONFIRM_CANDIDATES",
        selectedCandidateIds: [
          "candidate-customer",
          "candidate-flow",
          "candidate-claim-flow",
          "candidate-relation-customer-claim",
          "candidate-metric-claim"
        ]
      },
      "데이터 구조 확정",
      "workspace",
      analyzed.session.workspaceId
    )
  );

  assert.equal(blocked.permissionDenied, "선택한 업무 흐름마다 연결 지표를 하나 이상 포함해야 합니다.");
  assert.equal(blocked.entities.length, 0);
  assert.equal(blocked.workflowMetricBindings.length, 0);
});

test("candidate selections create different insights and proposal drafts", () => {
  const initial = createInitialState();
  const uploaded = reducer(initial, audited(initial, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-orders"));
  const analyzed = reducer(uploaded, {
    type: "START_ANALYSIS",
    ...commandMeta(uploaded, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });
  const scenarios = [
    {
      ids: ["candidate-customer", "candidate-claim-flow", "candidate-relation-customer-claim", "candidate-metric-claim"],
      insightId: "insight-customer-claims",
      proposalId: "proposal-customer-care"
    },
    {
      ids: ["candidate-supplier", "candidate-flow", "candidate-relation", "candidate-metric-delay"],
      insightId: "insight-supplier-delay",
      proposalId: "proposal-supplier-terms"
    },
    {
      ids: ["candidate-product-group", "candidate-flow", "candidate-claim-flow", "candidate-relation", "candidate-relation-customer-claim", "candidate-metric-margin", "candidate-metric-claim"],
      insightId: "insight-product-margin",
      proposalId: "proposal-product-margin"
    }
  ];

  const results = scenarios.map((scenario) => {
    const confirmed = reducer(
      analyzed,
      audited(
        analyzed,
        { type: "CONFIRM_CANDIDATES", selectedCandidateIds: scenario.ids },
        "데이터 구조 확정",
        "workspace",
        analyzed.session.workspaceId
      )
    );
    const proposed = reducer(
      confirmed,
      audited(confirmed, { type: "CREATE_PROPOSAL_FROM_INSIGHT", insightId: confirmed.insights[0].id }, "의사결정 안건 생성", "proposal", scenario.proposalId)
    );

    return {
      insightId: confirmed.insights[0].id,
      metricIds: confirmed.metricDefinitions.map((metric) => metric.id),
      proposalId: proposed.proposals[0].id,
      proposalTitle: proposed.proposals[0].title
    };
  });

  assert.deepEqual(results.map((result) => result.insightId), scenarios.map((scenario) => scenario.insightId));
  assert.deepEqual(results.map((result) => result.proposalId), scenarios.map((scenario) => scenario.proposalId));
  assert.equal(results.every((result) => result.proposalId !== "proposal-margin-delay"), true);
  assert.notDeepEqual(results[0].metricIds, results[1].metricIds);
  assert.equal(new Set(results.map((result) => result.proposalTitle)).size, 3);
});

test("dashboard view exposes selection-based chart contracts and link targets", () => {
  const initial = createInitialState();
  const uploaded = reducer(initial, audited(initial, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-orders"));
  const analyzed = reducer(uploaded, {
    type: "START_ANALYSIS",
    ...commandMeta(uploaded, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });
  const confirmed = reducer(
    analyzed,
    audited(
      analyzed,
      {
        type: "CONFIRM_CANDIDATES",
        selectedCandidateIds: [
          "candidate-product-group",
          "candidate-flow",
          "candidate-claim-flow",
          "candidate-relation",
          "candidate-relation-customer-claim",
          "candidate-metric-margin",
          "candidate-metric-claim"
        ]
      },
      "데이터 구조 확정",
      "workspace",
      analyzed.session.workspaceId
    )
  );
  const view = getDashboardView(confirmed);
  const flowTarget = view.workflowListTarget;
  const focused = reducer(confirmed, { type: "NAVIGATE_TO_TARGET", target: flowTarget });

  assert.equal(view.mainInsight?.id, "insight-product-margin");
  assert.equal(view.primaryChart.type, "bar");
  assert.equal(view.metricWidgets[0].target.screen, "metrics");
  assert.equal(view.recentFlows.length, 5);
  assert.equal(view.recentFlows.some((flow) => flow.title === "클레임 접수"), true);
  assert.equal(flowTarget.screen, "workflow");
  assert.equal(focused.screen, "workflow");
  assert.equal(focused.navigationFocus?.focusId, undefined);
});

test("managed object view exposes focused object detail and typed graph links", () => {
  const initial = createInitialState();
  const uploaded = reducer(initial, audited(initial, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-orders"));
  const analyzed = reducer(uploaded, {
    type: "START_ANALYSIS",
    ...commandMeta(uploaded, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });
  const confirmed = reducer(
    analyzed,
    audited(
      analyzed,
      {
        type: "CONFIRM_CANDIDATES",
        selectedCandidateIds: [
          "candidate-customer",
          "candidate-supplier",
          "candidate-product-group",
          "candidate-flow",
          "candidate-claim-flow",
          "candidate-relation",
          "candidate-relation-customer-claim",
          "candidate-metric-delay",
          "candidate-metric-margin",
          "candidate-metric-claim"
        ]
      },
      "데이터 구조 확정",
      "workspace",
      analyzed.session.workspaceId
    )
  );
  const view = getManagedObjectView(confirmed, "entity-supplier-a");
  const relationDetail = getManagedObjectGraphItemDetail(view.detail, "edge-relation-supplier-product");

  assert.deepEqual(view.categories.map((category) => category.label), ["고객군", "공급사", "상품군"]);
  assert.equal(view.categories.find((category) => category.id === view.activeCategoryId)?.label, "공급사");
  assert.equal(view.detail.category?.label, "공급사");
  assert.equal(view.detail.instances.length, 1);
  assert.equal(view.detail.rootNodeId, "entity-supplier-a");
  assert.equal(view.detail.instances.some((instance) => instance.id === "entity-supplier-a"), true);
  assert.equal(view.detail.events.some((event) => event.id === "event-outbound"), true);
  assert.equal(view.detail.metrics.some(({ definition }) => definition.id === "metric-delay-time"), true);
  assert.equal(view.detail.defaultGraphItemId, "entity-supplier-a");
  assert.equal(view.detail.graphNodes.some((node) => node.type === "category"), false);
  assert.equal(view.detail.graphEdges.some((edge) => edge.label === "포함"), false);
  assert.deepEqual(
    view.detail.graphLegend.map((item) => item.edgeType),
    ["managed_object_structural", "managed_object_workflow", "workflow_sequence", "workflow_metric", "metric_insight"]
  );
  assert.equal(
    view.detail.graphEdges.some(
      (edge) =>
        edge.edgeType === "managed_object_structural" &&
        edge.fromId === "entity-supplier-a" &&
        edge.toId === "entity-low-margin" &&
        edge.confidence === 0.9 &&
        edge.metricIds?.includes("metric-delay-time") &&
        edge.evidenceIds?.includes("evidence-supplier")
    ),
    true
  );
  assert.equal(relationDetail?.kind, "edge");
  assert.equal(relationDetail?.subtitle, "관리대상 간 구조");

  const filteredView = getManagedObjectView(confirmed, "entity-supplier-a", { visibleEntityIds: ["entity-supplier-a"] });
  assert.equal(filteredView.detail.rootNodeId, "entity-supplier-a");
  assert.equal(filteredView.detail.graphNodes.some((node) => node.id === "entity-low-margin"), false);
  assert.equal(filteredView.detail.graphEdges.some((edge) => edge.id === "edge-relation-supplier-product"), false);

  const visibleRelationView = getManagedObjectView(confirmed, "entity-supplier-a", {
    visibleEntityIds: ["entity-supplier-a", "entity-low-margin"]
  });
  assert.equal(visibleRelationView.detail.graphNodes.some((node) => node.id === "entity-low-margin"), true);
  assert.equal(visibleRelationView.detail.graphEdges.some((edge) => edge.id === "edge-relation-supplier-product"), true);
});

test("managed object type updates propagate as category labels and deletion falls back to unspecified", () => {
  const initial = createInitialState();
  const uploaded = reducer(initial, audited(initial, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-orders"));
  const analyzed = reducer(uploaded, {
    type: "START_ANALYSIS",
    ...commandMeta(uploaded, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });
  const confirmed = reducer(
    analyzed,
    audited(analyzed, { type: "CONFIRM_CANDIDATES" }, "데이터 구조 확정", "workspace", analyzed.session.workspaceId)
  );
  const customerTypeId = confirmed.managedObjectTypes.find((type) => type.label === "고객군")?.id;
  assert.ok(customerTypeId);

  const renamed = reducer(
    confirmed,
    audited(
      confirmed,
      { type: "UPDATE_DOMAIN_TYPE", scope: "managed_object", typeId: customerTypeId, label: "고객 세그먼트", color: "pink" },
      "관리대상 유형 수정",
      "domain_type",
      customerTypeId
    )
  );
  const renamedView = getManagedObjectView(renamed, "entity-customer-core");

  assert.equal(renamed.entities.find((entity) => entity.id === "entity-customer-core")?.kind, "고객 세그먼트");
  assert.equal(renamedView.detail.category?.label, "고객 세그먼트");
  assert.equal(renamed.managedObjectTypes.find((type) => type.id === customerTypeId)?.color, "pink");

  const deleted = reducer(
    renamed,
    audited(
      renamed,
      { type: "DELETE_DOMAIN_TYPE", scope: "managed_object", typeId: customerTypeId },
      "관리대상 유형 삭제",
      "domain_type",
      customerTypeId
    )
  );
  const deletedEntity = deleted.entities.find((entity) => entity.id === "entity-customer-core");
  const deletedView = getManagedObjectView(deleted, "entity-customer-core");

  assert.ok(deletedEntity);
  assert.equal(displayTypeLabel(deletedEntity.kind), "미지정");
  assert.equal(deletedView.detail.category?.label, "미지정");
  assert.equal(deletedView.detail.instances.some((entity) => entity.id === "entity-customer-core"), true);
});

test("workflow type updates propagate to events and deletion keeps events as unspecified", () => {
  const initial = createInitialState();
  const uploaded = reducer(initial, audited(initial, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-orders"));
  const analyzed = reducer(uploaded, {
    type: "START_ANALYSIS",
    ...commandMeta(uploaded, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });
  const confirmed = reducer(
    analyzed,
    audited(analyzed, { type: "CONFIRM_CANDIDATES" }, "데이터 구조 확정", "workspace", analyzed.session.workspaceId)
  );
  const workflowTypeId = confirmed.workflowTypes.find((type) => type.label === "증가")?.id;
  assert.ok(workflowTypeId);

  const renamed = reducer(
    confirmed,
    audited(
      confirmed,
      { type: "UPDATE_DOMAIN_TYPE", scope: "workflow", typeId: workflowTypeId, label: "고객 응대", color: "emerald" },
      "업무흐름 유형 수정",
      "domain_type",
      workflowTypeId
    )
  );
  assert.equal(renamed.events.find((event) => event.id === "event-claim")?.workflowType, "고객 응대");
  assert.equal(renamed.events.find((event) => event.id === "event-compensation")?.workflowType, "검토");
  assert.equal(renamed.workflowTypes.find((type) => type.id === workflowTypeId)?.color, "emerald");

  const deleted = reducer(
    renamed,
    audited(
      renamed,
      { type: "DELETE_DOMAIN_TYPE", scope: "workflow", typeId: workflowTypeId },
      "업무흐름 유형 삭제",
      "domain_type",
      workflowTypeId
    )
  );

  assert.equal(deleted.events.some((event) => event.id === "event-claim"), true);
  assert.equal(displayTypeLabel(deleted.events.find((event) => event.id === "event-claim")?.workflowType), "미지정");
  assert.equal(displayTypeLabel(deleted.events.find((event) => event.id === "event-compensation")?.workflowType), "검토");
});

test("candidate edit keeps the exact submitted title and description", () => {
  const initial = createInitialState();
  const uploaded = reducer(initial, audited(initial, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-orders"));
  const analyzed = reducer(uploaded, {
    type: "START_ANALYSIS",
    ...commandMeta(uploaded, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });
  const edited = reducer(
    analyzed,
    audited(
      analyzed,
      {
        type: "EDIT_CANDIDATE",
        candidateId: "candidate-customer",
        description: "고객 반복 구매와 클레임 영향도를 함께 보는 핵심 고객군",
        note: "검토자가 후보명을 직접 수정했습니다.",
        title: "핵심 고객군"
      },
      "후보 수정",
      "extraction_candidate",
      "candidate-customer"
    )
  );
  const editedAgain = reducer(
    edited,
    audited(
      edited,
      {
        type: "EDIT_CANDIDATE",
        candidateId: "candidate-customer",
        description: "고객 반복 구매와 클레임 영향도를 함께 보는 핵심 고객군",
        note: "같은 제목을 다시 저장했습니다.",
        title: "핵심 고객군"
      },
      "후보 수정",
      "extraction_candidate",
      "candidate-customer"
    )
  );
  const candidate = editedAgain.candidates.find((item) => item.id === "candidate-customer");

  assert.equal(candidate?.title, "핵심 고객군");
  assert.equal(candidate?.description, "고객 반복 구매와 클레임 영향도를 함께 보는 핵심 고객군");
  assert.equal(candidate?.status, "edited");
});

test("finalization creates decision and audit before verification", () => {
  const initial = createInitialState();
  const uploaded = reducer(initial, audited(initial, { type: "UPLOAD_SAMPLE_FILES" }, "소스 데이터 업로드", "source_file", "source-orders"));
  const analyzed = reducer(uploaded, {
    type: "START_ANALYSIS",
    ...commandMeta(uploaded, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "분석 시작 테스트")
  });
  const confirmed = reducer(
    analyzed,
    audited(analyzed, { type: "CONFIRM_CANDIDATES" }, "데이터 구조 확정", "workspace", analyzed.session.workspaceId)
  );
  const proposed = reducer(
    confirmed,
    audited(confirmed, { type: "CREATE_PROPOSAL_FROM_INSIGHT", insightId: confirmed.insights[0].id }, "의사결정 안건 생성", "proposal", "proposal-customer-care")
  );
  const proposalId = proposed.proposals[0].id;
  const managerVoted = reducer(proposed, {
    type: "CAST_VOTE",
    proposalId,
    choice: "approve",
    reason: "매니저 테스트",
    ...commandMeta(proposed, "투표 참여", "proposal", proposalId, "투표 테스트")
  });
  const memberSession = reducer(managerVoted, {
    type: "LOGIN",
    userId: "user-member",
    role: "member",
    ...commandMeta(managerVoted, "로그인", "session", "user-member", "구성원 로그인 테스트")
  });
  const memberVoted = reducer(memberSession, {
    type: "CAST_VOTE",
    proposalId,
    choice: "approve",
    reason: "구성원 테스트",
    ...commandMeta(memberSession, "투표 참여", "proposal", proposalId, "구성원 투표 테스트")
  });
  const managerSession = reducer(memberVoted, {
    type: "LOGIN",
    userId: "user-manager",
    role: "manager",
    ...commandMeta(memberVoted, "로그인", "session", "user-manager", "매니저 재로그인 테스트")
  });
  const finalized = reducer(managerSession, {
    type: "FINALIZE_PROPOSAL",
    proposalId,
    ...commandMeta(managerSession, "의사결정 결과 확정", "decision", "decision-customer-care", "확정 테스트")
  });

  assert.equal(finalized.decisions.length, 1);
  assert.equal(finalized.auditLogs.some((log) => log.action === "의사결정 결과 확정"), true);
  assert.equal(finalized.verificationRecords.length, 0);
});
