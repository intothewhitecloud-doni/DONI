import { summarizeVotes } from "../policies/voting";
import { initialPrototypeState as preparedData } from "./mock-data";
import { buildProposalDraftFromInsight, buildWorkspaceResultBundle, decisionIdForProposal, workflowsHaveSelectedMetrics } from "./result-scenarios";
import { sampleCandidateOperationalMap } from "./sample-analysis";
import {
  defaultTypeColor,
  displayTypeLabel,
  domainTypeId,
  normalizeDomainTypeCatalog,
  normalizeTypeColor,
  normalizeTypeLabel
} from "./type-catalog";
import type {
  AnalysisJob,
  AuditLog,
  CandidateType,
  Decision,
  DomainTypeDefinition,
  DomainTypeScope,
  LinkTarget,
  OutcomeRecord,
  Proposal,
  PrototypeState,
  Role,
  Screen,
  SourceFile,
  VerificationRecord,
  VoteChoice,
  Workspace,
  WorkspaceOperationalState,
  WorkspaceMember
} from "./types";

export const SOLE_ADMIN_LEAVE_BLOCKED_MESSAGE = "먼저 다른 사용자에게 관리자 권한을 승계한 뒤 나갈 수 있습니다.";

type ActionMeta = {
  auditLog?: AuditLog;
  notificationId?: string;
  now?: string;
};

export type PrototypeAction = ActionMeta &
  (
    | { type: "NAVIGATE"; screen: Screen }
    | { type: "NAVIGATE_TO_TARGET"; target: LinkTarget }
    | { type: "LOGIN"; userId: string; role: Role }
    | { type: "RESTORE_USER_STATE"; state: PrototypeState; userId: string; role: Role; screen: Screen }
    | { type: "LOGOUT" }
    | { type: "SELECT_WORKSPACE"; workspaceId: string }
    | { type: "CREATE_WORKSPACE"; name: string; industry: string; goal: string }
    | { type: "JOIN_WORKSPACE"; member: WorkspaceMember; workspaceId: string }
    | { type: "LEAVE_WORKSPACE"; workspaceId: string }
    | { type: "UPDATE_WORKSPACE"; workspaceId: string; name: string; industry: string; goal: string }
    | { type: "REGENERATE_INVITE_CODE"; workspaceId: string; inviteCode: string }
    | { type: "UPDATE_MEMBER"; memberId: string; role: Role; eligibleVoter: boolean; title: string }
    | { type: "ACTIVATE_MEMBER"; memberId: string }
    | { type: "DEACTIVATE_MEMBER"; memberId: string }
    | { type: "SET_ROLE"; role: Role }
    | { type: "SET_CANDIDATE_TYPE"; candidateType: CandidateType }
    | { type: "ADD_SOURCE_FILES"; files: SourceFile[] }
    | { type: "UPDATE_SOURCE_FILE"; fileId: string; patch: Pick<SourceFile, "kind" | "name"> }
    | { type: "REMOVE_SOURCE_FILE"; fileId: string }
    | { type: "ADD_DOMAIN_TYPE"; scope: DomainTypeScope; label: string; color?: string }
    | { type: "UPDATE_DOMAIN_TYPE"; scope: DomainTypeScope; typeId: string; label: string; color?: string }
    | { type: "DELETE_DOMAIN_TYPE"; scope: DomainTypeScope; typeId: string }
    | { type: "UPLOAD_SAMPLE_FILES" }
    | { type: "START_ANALYSIS" }
    | { type: "ADVANCE_ANALYSIS" }
    | { type: "EDIT_CANDIDATE"; candidateId: string; title: string; description?: string; note: string }
    | { type: "EXCLUDE_CANDIDATE"; candidateId: string }
    | { type: "CONFIRM_CANDIDATES"; selectedCandidateIds?: string[] }
    | { type: "CREATE_PROPOSAL_FROM_INSIGHT"; insightId: string }
    | { type: "CAST_VOTE"; proposalId: string; choice: VoteChoice; reason: string }
    | { type: "FINALIZE_PROPOSAL"; proposalId: string }
    | { type: "ADD_VERIFICATION"; record: VerificationRecord }
    | { type: "RECORD_OUTCOME"; decisionId: string; beforeMetricValue: number; afterMetricValue: number; summary: string }
    | { type: "SET_PERMISSION_DENIED"; message?: string }
    | { type: "SET_SIMULATED_ERROR"; message?: string }
  );

const analysisSteps: Array<{ status: AnalysisJob["status"]; progress: number; label: string }> = [
  { status: "queued", progress: 8, label: "원본 표 구조 읽기 대기" },
  { status: "parsing", progress: 24, label: "원본 표 구조 읽기" },
  { status: "extracting", progress: 44, label: "관리대상 후보 생성" },
  { status: "extracting", progress: 62, label: "업무흐름 후보 생성" },
  { status: "extracting", progress: 78, label: "관계 연결 구성과 지표 계산" },
  { status: "reviewing_ready", progress: 100, label: "인사이트 근거 조합 완료" }
];

const candidateOperationalMap = sampleCandidateOperationalMap;

function collectMappedIds(map: Record<string, readonly string[]>, selectedCandidateIds: Set<string>): Set<string> {
  const ids = new Set<string>();
  selectedCandidateIds.forEach((candidateId) => {
    map[candidateId]?.forEach((id) => ids.add(id));
  });
  return ids;
}

function operationalDataForCandidates(selectedCandidateIds: Set<string>, candidates: PrototypeState["candidates"]) {
  const entityIds = collectMappedIds(candidateOperationalMap.entityIds, selectedCandidateIds);
  const eventIds = collectMappedIds(candidateOperationalMap.eventIds, selectedCandidateIds);
  const relationIds = collectMappedIds(candidateOperationalMap.relationIds, selectedCandidateIds);
  const metricIds = collectMappedIds(candidateOperationalMap.metricIds, selectedCandidateIds);

  return buildWorkspaceResultBundle({
    candidates,
    selectedCandidateIds,
    entityIds,
    eventIds,
    relationIds,
    metricIds,
    entities: preparedData.entities.filter((entity) => entityIds.has(entity.id)),
    events: preparedData.events.filter((event) => eventIds.has(event.id)),
    metricDefinitions: preparedData.metricDefinitions.filter((metric) => metricIds.has(metric.id)),
    metricValues: preparedData.metricValues.filter((metricValue) => metricIds.has(metricValue.metricId)),
    relations: preparedData.relations.filter((relation) => relationIds.has(relation.id)),
    workflowMetricBindings: preparedData.workflowMetricBindings.filter(
      (binding) => eventIds.has(binding.eventId) && metricIds.has(binding.metricId)
    )
  });
}

const emptyOperationalCollections = {
  sourceFiles: [],
  analysisJobs: [],
  evidence: [],
  candidates: [],
  managedObjectTypes: [],
  workflowTypes: [],
  entities: [],
  events: [],
  relations: [],
  metricDefinitions: [],
  metricValues: [],
  workflowMetricBindings: [],
  insights: [],
  proposals: [],
  votes: [],
  decisions: [],
  verificationRecords: [],
  outcomes: [],
  auditLogs: [],
  notifications: []
} satisfies Pick<
  WorkspaceOperationalState,
  | "sourceFiles"
  | "analysisJobs"
  | "evidence"
  | "candidates"
  | "managedObjectTypes"
  | "workflowTypes"
  | "entities"
  | "events"
  | "relations"
  | "metricDefinitions"
  | "metricValues"
  | "workflowMetricBindings"
  | "insights"
  | "proposals"
  | "votes"
  | "decisions"
  | "verificationRecords"
  | "outcomes"
  | "auditLogs"
  | "notifications"
>;

export function createEmptyWorkspaceData(workspace: Workspace): WorkspaceOperationalState {
  return {
    company: {
      name: workspace.name,
      industry: workspace.industry,
      goal: workspace.decisionGoal,
      dataReadiness: "draft"
    },
    ...structuredClone(emptyOperationalCollections),
    activeCandidateType: "managed_object",
    activeInsightId: "",
    activeProposalId: "",
    selection: undefined,
    scope: undefined
  };
}

export function workspaceDataFromState(state: PrototypeState): WorkspaceOperationalState {
  return {
    company: state.company,
    sourceFiles: state.sourceFiles,
    analysisJobs: state.analysisJobs,
    evidence: state.evidence,
    candidates: state.candidates,
    managedObjectTypes: state.managedObjectTypes,
    workflowTypes: state.workflowTypes,
    entities: state.entities,
    events: state.events,
    relations: state.relations,
    metricDefinitions: state.metricDefinitions,
    metricValues: state.metricValues,
    workflowMetricBindings: state.workflowMetricBindings,
    insights: state.insights,
    proposals: state.proposals,
    votes: state.votes,
    decisions: state.decisions,
    verificationRecords: state.verificationRecords,
    outcomes: state.outcomes,
    auditLogs: state.auditLogs,
    notifications: state.notifications,
    activeCandidateType: state.activeCandidateType,
    activeInsightId: state.activeInsightId,
    activeProposalId: state.activeProposalId,
    selection: state.selection,
    scope: state.scope
  };
}

function inferDomainTypes(scope: DomainTypeScope, labels: string[]): DomainTypeDefinition[] {
  return Array.from(new Set(labels.map(displayTypeLabel)))
    .filter((label) => label !== "미지정")
    .map((label, index, allLabels) => ({
      id: domainTypeId(scope, label, allLabels.slice(0, index).map((priorLabel) => domainTypeId(scope, priorLabel))),
      scope,
      label,
      color: defaultTypeColor(index)
    }));
}

function mergeDomainTypes(scope: DomainTypeScope, existing: DomainTypeDefinition[], inferred: DomainTypeDefinition[]): DomainTypeDefinition[] {
  const normalizedExisting = normalizeDomainTypeCatalog(existing, scope);
  const labels = new Set(normalizedExisting.map((item) => normalizeTypeLabel(item.label)));
  return [
    ...normalizedExisting,
    ...normalizeDomainTypeCatalog(inferred, scope).filter((item) => {
      const label = normalizeTypeLabel(item.label);
      if (labels.has(label)) {
        return false;
      }
      labels.add(label);
      return true;
    })
  ];
}

function normalizeWorkspaceData(data: WorkspaceOperationalState, workspace: Workspace): WorkspaceOperationalState {
  const empty = createEmptyWorkspaceData(workspace);

  return {
    ...empty,
    ...data,
    company: { ...empty.company, ...data.company },
    managedObjectTypes: normalizeDomainTypeCatalog(data.managedObjectTypes ?? inferDomainTypes("managed_object", data.entities.map((entity) => entity.kind)), "managed_object"),
    workflowTypes: normalizeDomainTypeCatalog(data.workflowTypes ?? inferDomainTypes("workflow", data.events.map((event) => event.workflowType)), "workflow"),
    metricValues: normalizeMetricValues(data.metricValues ?? []),
    workflowMetricBindings: data.workflowMetricBindings ?? [],
    selection: data.selection,
    scope: data.scope
  };
}

function normalizeMetricValues(metricValues: WorkspaceOperationalState["metricValues"]): WorkspaceOperationalState["metricValues"] {
  return metricValues.map((metricValue) => {
    if (isLegacyClaimRateTimeSeries(metricValue)) {
      const preparedClaimRate = preparedData.metricValues.find((item) => item.id === metricValue.id);

      return {
        ...metricValue,
        basis: { ...metricValue.basis, ...preparedClaimRate?.basis },
        series: structuredClone(preparedClaimRate?.series ?? metricValue.series)
      };
    }

    if (metricValue.chartType !== "time_series") {
      return metricValue;
    }

    return {
      ...metricValue,
      series: sortMetricSeriesPoints(metricValue.series)
    };
  });
}

function isLegacyClaimRateTimeSeries(metricValue: WorkspaceOperationalState["metricValues"][number]): boolean {
  const legacyLabels = ["일반 고객군", "고객A", "P-08", "P-42"];

  return (
    metricValue.id === "metric-value-claim" &&
    metricValue.metricId === "metric-claim-rate" &&
    metricValue.chartType === "time_series" &&
    metricValue.series.length === legacyLabels.length &&
    metricValue.series.every((point, index) => !point.observedAt && point.label === legacyLabels[index])
  );
}

function sortMetricSeriesPoints(points: WorkspaceOperationalState["metricValues"][number]["series"]) {
  return [...points].sort((left, right) => {
    const leftTime = left.observedAt ? Date.parse(left.observedAt) : Number.NaN;
    const rightTime = right.observedAt ? Date.parse(right.observedAt) : Number.NaN;

    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) {
      return leftTime - rightTime;
    }

    return left.label.localeCompare(right.label);
  });
}

function ensureWorkspaceDataById(state: PrototypeState): Record<string, WorkspaceOperationalState> {
  return state.workspaces.reduce<Record<string, WorkspaceOperationalState>>(
    (dataById, workspace) => ({
      ...dataById,
      [workspace.id]: dataById[workspace.id] ? normalizeWorkspaceData(dataById[workspace.id], workspace) : createEmptyWorkspaceData(workspace)
    }),
    { ...state.workspaceDataById }
  );
}

export function currentWorkspaceData(state: PrototypeState): WorkspaceOperationalState {
  const dataById = ensureWorkspaceDataById(state);
  const workspace = state.workspaces.find((item) => item.id === state.session.workspaceId);

  return workspace ? dataById[workspace.id] ?? createEmptyWorkspaceData(workspace) : emptyProjectedWorkspaceData();
}

function emptyProjectedWorkspaceData(): WorkspaceOperationalState {
  return {
    company: {
      name: "",
      industry: "",
      goal: "",
      dataReadiness: "draft"
    },
    ...structuredClone(emptyOperationalCollections),
    activeCandidateType: "managed_object",
    activeInsightId: "",
    activeProposalId: "",
    selection: undefined,
    scope: undefined
  };
}

export function projectWorkspaceData(state: PrototypeState, workspaceId = state.session.workspaceId): PrototypeState {
  const dataById = ensureWorkspaceDataById(state);
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  const data = workspace ? dataById[workspace.id] ?? createEmptyWorkspaceData(workspace) : emptyProjectedWorkspaceData();

  return {
    ...state,
    workspaceDataById: workspace ? { ...dataById, [workspace.id]: data } : dataById,
    company: data.company,
    sourceFiles: data.sourceFiles,
    analysisJobs: data.analysisJobs,
    evidence: data.evidence,
    candidates: data.candidates,
    managedObjectTypes: data.managedObjectTypes,
    workflowTypes: data.workflowTypes,
    entities: data.entities,
    events: data.events,
    relations: data.relations,
    metricDefinitions: data.metricDefinitions,
    metricValues: data.metricValues,
    workflowMetricBindings: data.workflowMetricBindings,
    insights: data.insights,
    proposals: data.proposals,
    votes: data.votes,
    decisions: data.decisions,
    verificationRecords: data.verificationRecords,
    outcomes: data.outcomes,
    auditLogs: data.auditLogs,
    notifications: data.notifications,
    activeCandidateType: data.activeCandidateType,
    activeInsightId: data.activeInsightId,
    activeProposalId: data.activeProposalId,
    selection: data.selection,
    scope: data.scope
  };
}

export function userCanAccessWorkspace(state: PrototypeState, workspaceId: string, userId = state.session.currentUserId): boolean {
  return state.members.some(
    (member) => member.userId === userId && member.workspaceId === workspaceId && member.status === "active"
  );
}

function activeWorkspaceMembers(state: PrototypeState, workspaceId: string): WorkspaceMember[] {
  return state.members.filter((member) => member.workspaceId === workspaceId && member.status === "active");
}

export function willDeleteWorkspaceOnLeave(state: PrototypeState, workspaceId: string, userId = state.session.currentUserId): boolean {
  const activeMembers = activeWorkspaceMembers(state, workspaceId);

  return activeMembers.length === 1 && activeMembers[0]?.userId === userId;
}

export function isSoleActiveWorkspaceAdmin(state: PrototypeState, workspaceId: string, userId = state.session.currentUserId): boolean {
  const activeAdmins = activeWorkspaceMembers(state, workspaceId).filter((member) => member.role === "admin");

  return activeAdmins.length === 1 && activeAdmins[0]?.userId === userId;
}

export function shouldBlockWorkspaceLeaveForSoleAdmin(state: PrototypeState, workspaceId: string, userId = state.session.currentUserId): boolean {
  return isSoleActiveWorkspaceAdmin(state, workspaceId, userId) && !willDeleteWorkspaceOnLeave(state, workspaceId, userId);
}

function firstAccessibleWorkspaceId(state: PrototypeState, userId: string): string {
  const activeWorkspaceIds = new Set(
    state.members
      .filter((member) => member.userId === userId && member.status === "active")
      .map((member) => member.workspaceId)
  );

  return state.workspaces.find((workspace) => activeWorkspaceIds.has(workspace.id))?.id ?? "";
}

function accountRole(state: PrototypeState, userId: string): Role {
  return state.users.find((user) => user.id === userId)?.role ?? state.session.role;
}

function workspaceRoleForUser(state: PrototypeState, userId: string, workspaceId: string): Role {
  return (
    state.members.find(
      (member) => member.userId === userId && member.workspaceId === workspaceId && member.status === "active"
    )?.role ?? accountRole(state, userId)
  );
}

function syncActiveWorkspaceData(state: PrototypeState): PrototypeState {
  const dataById = ensureWorkspaceDataById(state);
  const workspace = state.workspaces.find((item) => item.id === state.session.workspaceId);
  if (!workspace) {
    return { ...state, workspaceDataById: dataById };
  }

  return {
    ...state,
    workspaceDataById: {
      ...dataById,
      [workspace.id]: workspaceDataFromState(state)
    }
  };
}

function latestJob(state: PrototypeState): AnalysisJob | undefined {
  return state.analysisJobs[0];
}

function updateLatestJob(state: PrototypeState, updater: (job: AnalysisJob) => AnalysisJob): PrototypeState {
  const [job, ...rest] = state.analysisJobs;
  if (!job) {
    return state;
  }

  return { ...state, analysisJobs: [updater(job), ...rest] };
}

function at(action: ActionMeta): string {
  return action.now ?? "2026-05-07T09:00:00.000Z";
}

function withAudit(state: PrototypeState, action: ActionMeta): PrototypeState {
  const audited = action.auditLog ? { ...state, auditLogs: [action.auditLog, ...state.auditLogs] } : state;

  return syncActiveWorkspaceData(audited);
}

function clearAnalysisOutputs(state: PrototypeState): PrototypeState {
  return {
    ...state,
    activeCandidateType: "managed_object",
    activeInsightId: "",
    activeProposalId: "",
    navigationFocus: undefined,
    analysisJobs: [],
    candidates: [],
    decisions: [],
    managedObjectTypes: [],
    workflowTypes: [],
    entities: [],
    events: [],
    evidence: [],
    insights: [],
    metricDefinitions: [],
    metricValues: [],
    workflowMetricBindings: [],
    outcomes: [],
    proposals: [],
    relations: [],
    verificationRecords: [],
    votes: [],
    selection: undefined,
    scope: undefined
  };
}

function omitWorkspaceData(
  dataById: Record<string, WorkspaceOperationalState>,
  workspaceId: string
): Record<string, WorkspaceOperationalState> {
  const nextDataById = { ...dataById };
  delete nextDataById[workspaceId];
  return nextDataById;
}

function typeCatalogForScope(state: PrototypeState, scope: DomainTypeScope): DomainTypeDefinition[] {
  return scope === "managed_object" ? state.managedObjectTypes : state.workflowTypes;
}

function withTypeCatalog(state: PrototypeState, scope: DomainTypeScope, catalog: DomainTypeDefinition[]): PrototypeState {
  const normalizedCatalog = normalizeDomainTypeCatalog(catalog, scope);
  return scope === "managed_object"
    ? { ...state, managedObjectTypes: normalizedCatalog, permissionDenied: undefined }
    : { ...state, workflowTypes: normalizedCatalog, permissionDenied: undefined };
}

function addDomainType(state: PrototypeState, scope: DomainTypeScope, label: string, color?: string): PrototypeState {
  const normalizedLabel = normalizeTypeLabel(label);
  if (!normalizedLabel) {
    return { ...state, permissionDenied: "추가할 유형 이름을 입력해 주세요." };
  }

  const catalog = typeCatalogForScope(state, scope);
  if (catalog.some((item) => normalizeTypeLabel(item.label) === normalizedLabel)) {
    return { ...state, permissionDenied: "이미 등록된 유형입니다." };
  }

  const typeDefinition: DomainTypeDefinition = {
    id: domainTypeId(scope, normalizedLabel, catalog.map((item) => item.id)),
    scope,
    label: normalizedLabel,
    color: normalizeTypeColor(color) === "slate" && !color ? defaultTypeColor(catalog.length) : normalizeTypeColor(color)
  };

  return withTypeCatalog(state, scope, [...catalog, typeDefinition]);
}

function updateDomainType(state: PrototypeState, scope: DomainTypeScope, typeId: string, label: string, color?: string): PrototypeState {
  const normalizedLabel = normalizeTypeLabel(label);
  if (!normalizedLabel) {
    return { ...state, permissionDenied: "수정할 유형 이름을 입력해 주세요." };
  }

  const catalog = typeCatalogForScope(state, scope);
  const current = catalog.find((item) => item.id === typeId);
  if (!current) {
    return { ...state, permissionDenied: "수정할 유형을 찾지 못했습니다." };
  }

  if (catalog.some((item) => item.id !== typeId && normalizeTypeLabel(item.label) === normalizedLabel)) {
    return { ...state, permissionDenied: "이미 등록된 유형입니다." };
  }

  const updatedCatalog = catalog.map((item) =>
    item.id === typeId ? { ...item, label: normalizedLabel, color: color === undefined ? item.color : normalizeTypeColor(color) } : item
  );
  const updatedState = withTypeCatalog(state, scope, updatedCatalog);

  if (scope === "managed_object") {
    return {
      ...updatedState,
      entities: updatedState.entities.map((entity) =>
        normalizeTypeLabel(entity.kind) === normalizeTypeLabel(current.label) ? { ...entity, kind: normalizedLabel } : entity
      )
    };
  }

  return {
    ...updatedState,
    events: updatedState.events.map((event) =>
      normalizeTypeLabel(event.workflowType) === normalizeTypeLabel(current.label) ? { ...event, workflowType: normalizedLabel } : event
    )
  };
}

function deleteDomainType(state: PrototypeState, scope: DomainTypeScope, typeId: string): PrototypeState {
  const catalog = typeCatalogForScope(state, scope);
  const current = catalog.find((item) => item.id === typeId);
  if (!current) {
    return { ...state, permissionDenied: "삭제할 유형을 찾지 못했습니다." };
  }

  const updatedState = withTypeCatalog(state, scope, catalog.filter((item) => item.id !== typeId));
  if (scope === "managed_object") {
    return {
      ...updatedState,
      entities: updatedState.entities.map((entity) =>
        normalizeTypeLabel(entity.kind) === normalizeTypeLabel(current.label) ? { ...entity, kind: "" } : entity
      )
    };
  }

  return {
    ...updatedState,
    events: updatedState.events.map((event) =>
      normalizeTypeLabel(event.workflowType) === normalizeTypeLabel(current.label) ? { ...event, workflowType: "" } : event
    )
  };
}

export function reducer(state: PrototypeState, action: PrototypeAction): PrototypeState {
  switch (action.type) {
    case "NAVIGATE":
      return { ...state, screen: action.screen, navigationFocus: undefined, permissionDenied: undefined, simulatedError: undefined };

    case "NAVIGATE_TO_TARGET":
      return {
        ...state,
        screen: action.target.screen,
        navigationFocus: action.target,
        permissionDenied: undefined,
        simulatedError: undefined
      };

    case "LOGIN":
      const loginWorkspaceId = firstAccessibleWorkspaceId(state, action.userId);
      return withAudit(
        projectWorkspaceData(
          {
            ...state,
            session: {
              ...state.session,
              currentUserId: action.userId,
              loggedIn: true,
              role: loginWorkspaceId ? workspaceRoleForUser(state, action.userId, loginWorkspaceId) : action.role,
              workspaceId: loginWorkspaceId
            },
            screen: "workspace",
            navigationFocus: undefined,
            permissionDenied: undefined,
            simulatedError: undefined
          },
          loginWorkspaceId
        ),
        action
      );

    case "RESTORE_USER_STATE": {
      const restoredState = {
        ...state,
        ...action.state,
        screen: action.screen,
        session: {
          ...action.state.session,
          currentUserId: action.userId,
          loggedIn: true,
          role: action.state.session.workspaceId
            ? workspaceRoleForUser(action.state, action.userId, action.state.session.workspaceId)
            : action.role
        },
        users: state.users,
        navigationFocus: undefined,
        permissionDenied: undefined,
        simulatedError: undefined
      };
      return withAudit(
        projectWorkspaceData(restoredState),
        action
      );
    }

    case "LOGOUT":
      return withAudit(
        {
          ...state,
          session: { ...state.session, loggedIn: false },
          screen: "login",
          navigationFocus: undefined,
          permissionDenied: undefined,
          simulatedError: undefined
        },
        action
      );

    case "SELECT_WORKSPACE": {
      const syncedState = syncActiveWorkspaceData(state);
      const workspace = syncedState.workspaces.find((item) => item.id === action.workspaceId);
      if (!workspace || !userCanAccessWorkspace(syncedState, workspace.id)) {
        return {
          ...syncedState,
          screen: "workspace",
          navigationFocus: undefined,
          permissionDenied: "현재 사용자는 해당 그룹에 속해 있지 않습니다."
        };
      }
      const projectedState = projectWorkspaceData(
        {
          ...syncedState,
          screen: "dashboard",
          navigationFocus: undefined,
          session: {
            ...syncedState.session,
            role: workspaceRoleForUser(syncedState, syncedState.session.currentUserId, workspace.id),
            workspaceId: workspace.id
          }
        },
        workspace.id
      );
      return withAudit(
        { ...projectedState, company: { ...projectedState.company, dataReadiness: "ready" } },
        action
      );
    }

    case "JOIN_WORKSPACE":
      return withAudit(
        projectWorkspaceData(
          {
            ...state,
            members: [action.member, ...state.members.filter((member) => member.id !== action.member.id)],
            screen: "dashboard",
            navigationFocus: undefined,
            session: { ...state.session, role: action.member.role, workspaceId: action.workspaceId },
            permissionDenied: undefined
          },
          action.workspaceId
        ),
        action
      );

    case "CREATE_WORKSPACE": {
      const workspaceId = `workspace-${action.name.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-") || "new"}`;
      const currentUser = state.users.find((user) => user.id === state.session.currentUserId) ?? state.users[0];
      const workspace: Workspace = {
        id: workspaceId,
        name: action.name,
        industry: action.industry,
        decisionGoal: action.goal,
        inviteCode: `DONI-${String(state.workspaces.length + 1).padStart(4, "0")}`
      };
      const creatorMember: WorkspaceMember = {
        id: `member-${workspaceId}-${currentUser.id}`,
        userId: currentUser.id,
        workspaceId,
        role: "admin",
        name: currentUser.name,
        title: currentUser.title,
        eligibleVoter: true,
        status: "active"
      };
      return withAudit(
        {
          ...state,
          screen: "workspace",
          navigationFocus: undefined,
          workspaces: [
            workspace,
            ...state.workspaces.filter((workspace) => workspace.id !== workspaceId)
          ],
          members: [
            creatorMember,
            ...state.members.filter((member) => !(member.workspaceId === workspaceId && member.userId === currentUser.id))
          ],
          workspaceDataById: {
            ...ensureWorkspaceDataById(state),
            [workspaceId]: createEmptyWorkspaceData(workspace)
          }
        },
        action
      );
    }

    case "LEAVE_WORKSPACE": {
      if (!userCanAccessWorkspace(state, action.workspaceId)) {
        return { ...state, permissionDenied: "현재 사용자는 해당 그룹에 속해 있지 않습니다." };
      }

      if (shouldBlockWorkspaceLeaveForSoleAdmin(state, action.workspaceId)) {
        return { ...state, permissionDenied: SOLE_ADMIN_LEAVE_BLOCKED_MESSAGE };
      }

      const deleteWorkspace = willDeleteWorkspaceOnLeave(state, action.workspaceId);
      const members = deleteWorkspace
        ? state.members.filter((member) => member.workspaceId !== action.workspaceId)
        : state.members.map((member) =>
            member.userId === state.session.currentUserId && member.workspaceId === action.workspaceId
              ? { ...member, status: "inactive" as const, eligibleVoter: false }
              : member
          );
      const nextState = deleteWorkspace
        ? {
            ...state,
            members,
            workspaces: state.workspaces.filter((workspace) => workspace.id !== action.workspaceId),
            workspaceDataById: omitWorkspaceData(state.workspaceDataById, action.workspaceId)
          }
        : { ...state, members };
      const nextWorkspaceId = firstAccessibleWorkspaceId(nextState, state.session.currentUserId);
      const session = {
        ...state.session,
        role: nextWorkspaceId ? workspaceRoleForUser(nextState, state.session.currentUserId, nextWorkspaceId) : accountRole(state, state.session.currentUserId),
        workspaceId: nextWorkspaceId
      };

      return withAudit(
        projectWorkspaceData(
          {
            ...nextState,
            screen: "workspace",
            navigationFocus: undefined,
            session,
            permissionDenied: undefined
          },
          nextWorkspaceId
        ),
        action
      );
    }

    case "UPDATE_WORKSPACE": {
      const dataById = ensureWorkspaceDataById(state);
      const targetWorkspace = state.workspaces.find((workspace) => workspace.id === action.workspaceId);
      const targetData =
        dataById[action.workspaceId] ??
        (targetWorkspace
          ? createEmptyWorkspaceData(targetWorkspace)
          : {
            ...workspaceDataFromState(state),
            company: { ...state.company, name: action.name, industry: action.industry, goal: action.goal }
          });
      return withAudit(
        {
          ...state,
          company:
            state.session.workspaceId === action.workspaceId
              ? { ...state.company, name: action.name, industry: action.industry, goal: action.goal }
              : state.company,
          workspaces: state.workspaces.map((workspace) =>
            workspace.id === action.workspaceId
              ? { ...workspace, name: action.name, industry: action.industry, decisionGoal: action.goal }
              : workspace
          ),
          workspaceDataById: {
            ...dataById,
            [action.workspaceId]: {
              ...targetData,
              company: { ...targetData.company, name: action.name, industry: action.industry, goal: action.goal }
            }
          }
        },
        action
      );
    }

    case "REGENERATE_INVITE_CODE":
      return withAudit(
        {
          ...state,
          workspaces: state.workspaces.map((workspace) =>
            workspace.id === action.workspaceId ? { ...workspace, inviteCode: action.inviteCode } : workspace
          ),
          notifications: [
            { id: action.notificationId ?? "notice-invite-code", level: "success", message: "그룹 초대 코드가 새로 발급되었습니다." },
            ...state.notifications
          ]
        },
        action
      );

    case "UPDATE_MEMBER":
      {
        const members = state.members.map((member) =>
          member.id === action.memberId
            ? { ...member, role: action.role, eligibleVoter: action.eligibleVoter, title: action.title }
            : member
        );
        const updatedState = { ...state, members };
        return withAudit(
          {
            ...updatedState,
            session: {
              ...state.session,
              role: workspaceRoleForUser(updatedState, state.session.currentUserId, state.session.workspaceId)
            },
            notifications: [
              { id: action.notificationId ?? "notice-member-update", level: "success", message: "사용자 정보를 수정했습니다." },
              ...state.notifications
            ]
          },
          action
        );
      }

    case "ACTIVATE_MEMBER":
      return withAudit(
        {
          ...state,
          members: state.members.map((member) =>
            member.id === action.memberId ? { ...member, status: "active", eligibleVoter: true } : member
          ),
          notifications: [
            { id: action.notificationId ?? "notice-member-activate", level: "success", message: "사용자를 다시 활성화했습니다." },
            ...state.notifications
          ]
        },
        action
      );

    case "DEACTIVATE_MEMBER":
      {
        const members = state.members.map((member) =>
          member.id === action.memberId ? { ...member, status: "inactive" as const, eligibleVoter: false } : member
        );
        const deactivatedState = { ...state, members };
        const currentWorkspaceId = userCanAccessWorkspace(deactivatedState, state.session.workspaceId)
          ? state.session.workspaceId
          : firstAccessibleWorkspaceId(deactivatedState, state.session.currentUserId);

        return withAudit(
          projectWorkspaceData(
            {
              ...deactivatedState,
              session: {
                ...state.session,
                role: currentWorkspaceId
                  ? workspaceRoleForUser(deactivatedState, state.session.currentUserId, currentWorkspaceId)
                  : accountRole(state, state.session.currentUserId),
                workspaceId: currentWorkspaceId
              },
              notifications: [
                { id: action.notificationId ?? "notice-member-deactivate", level: "info", message: "사용자를 비활성화했습니다." },
                ...state.notifications
              ]
            },
            currentWorkspaceId
          ),
          action
        );
      }

    case "SET_ROLE": {
      const user = state.users.find((item) => item.role === action.role) ?? state.users[2];
      const workspaceId = firstAccessibleWorkspaceId(state, user.id);
      return projectWorkspaceData(
        {
          ...state,
          navigationFocus: undefined,
          session: {
            ...state.session,
            role: workspaceId ? workspaceRoleForUser(state, user.id, workspaceId) : action.role,
            currentUserId: user.id,
            workspaceId
          },
          permissionDenied: undefined
        },
        workspaceId
      );
    }

    case "SET_CANDIDATE_TYPE":
      return syncActiveWorkspaceData({ ...state, activeCandidateType: action.candidateType });

    case "ADD_SOURCE_FILES": {
      const incomingIds = new Set(action.files.map((file) => file.id));
      const incomingNameKeys = new Set(action.files.map((file) => file.name.trim().toLowerCase()));
      return withAudit(
        {
          ...state,
          screen: "vault",
          sourceFiles: [
            ...action.files.map((file) => ({ ...file, status: "ready" as const, uploadedAt: undefined })),
            ...state.sourceFiles
              .filter((file) => !incomingIds.has(file.id) && !incomingNameKeys.has(file.name.trim().toLowerCase()))
              .map((file) => ({ ...file, status: "ready" as const, uploadedAt: undefined }))
          ],
          notifications: [
            { id: action.notificationId ?? "notice-source-files", level: "success", message: "파일이 데이터 보관함에 추가되었습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "UPDATE_SOURCE_FILE": {
      return withAudit(
        {
          ...state,
          sourceFiles: state.sourceFiles.map((file) =>
            file.id === action.fileId ? { ...file, ...action.patch, status: "ready" as const, uploadedAt: undefined } : { ...file, status: "ready" as const, uploadedAt: undefined }
          ),
          notifications: [
            { id: action.notificationId ?? "notice-source-file-update", level: "success", message: "파일 정보가 수정되었습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "REMOVE_SOURCE_FILE": {
      return withAudit(
        {
          ...state,
          sourceFiles: state.sourceFiles
            .filter((file) => file.id !== action.fileId)
            .map((file) => ({ ...file, status: "ready" as const, uploadedAt: undefined })),
          notifications: [
            { id: action.notificationId ?? "notice-source-file-remove", level: "info", message: "파일이 데이터 보관함에서 제거되었습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "ADD_DOMAIN_TYPE": {
      const next = addDomainType(state, action.scope, action.label, action.color);
      if (next.permissionDenied) {
        return syncActiveWorkspaceData(next);
      }
      return withAudit(
        {
          ...next,
          notifications: [
            { id: action.notificationId ?? "notice-type-add", level: "success", message: "유형을 추가했습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "UPDATE_DOMAIN_TYPE": {
      const next = updateDomainType(state, action.scope, action.typeId, action.label, action.color);
      if (next.permissionDenied) {
        return syncActiveWorkspaceData(next);
      }
      return withAudit(
        {
          ...next,
          notifications: [
            { id: action.notificationId ?? "notice-type-update", level: "success", message: "유형을 수정했습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "DELETE_DOMAIN_TYPE": {
      const next = deleteDomainType(state, action.scope, action.typeId);
      if (next.permissionDenied) {
        return syncActiveWorkspaceData(next);
      }
      return withAudit(
        {
          ...next,
          notifications: [
            { id: action.notificationId ?? "notice-type-delete", level: "info", message: "유형을 삭제했습니다. 연결 항목은 미지정으로 표시됩니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "UPLOAD_SAMPLE_FILES": {
      const uploadedAt = at(action);
      const sourceFiles = state.sourceFiles.length > 0 ? state.sourceFiles : preparedData.sourceFiles;
      return withAudit(
        {
          ...state,
          screen: "analysis",
          sourceFiles: sourceFiles.map((file) => ({ ...file, status: "uploaded", uploadedAt })),
          notifications: [
            { id: action.notificationId ?? "notice-upload", level: "success", message: "소스 데이터가 업로드되었습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "START_ANALYSIS": {
      const sourceFiles = state.sourceFiles.length > 0 ? state.sourceFiles : preparedData.sourceFiles;
      const job: AnalysisJob = {
        id: "analysis-job-main",
        sourceFileIds: sourceFiles.map((file) => file.id),
        status: "queued",
        progress: 8,
        currentStep: analysisSteps[0].label,
        startedAt: at(action)
      };

      return withAudit(
        {
          ...state,
          screen: "analysis",
          analysisJobs: [job],
          evidence: preparedData.evidence,
          candidates: preparedData.candidates,
          activeCandidateType: "managed_object",
          sourceFiles: sourceFiles.map((file) => ({ ...file, status: "parsed" }))
        },
        action
      );
    }

    case "ADVANCE_ANALYSIS": {
      const job = latestJob(state);
      if (!job) {
        return state;
      }

      const currentIndex = analysisSteps.findIndex((step) => step.progress === job.progress);
      const nextStep = analysisSteps[Math.min(currentIndex + 1, analysisSteps.length - 1)];
      const next = updateLatestJob(state, (item) => ({
        ...item,
        status: nextStep.status,
        progress: nextStep.progress,
        currentStep: nextStep.label,
        completedAt: nextStep.status === "reviewing_ready" ? at(action) : item.completedAt
      }));

      return syncActiveWorkspaceData(nextStep.status === "reviewing_ready" ? { ...next, screen: "review" } : next);
    }

    case "EDIT_CANDIDATE":
      return withAudit(
        {
          ...state,
          candidates: state.candidates.map((candidate) =>
            candidate.id === action.candidateId
              ? { ...candidate, title: action.title, description: action.description ?? candidate.description, reviewerNote: action.note, status: "edited" }
              : candidate
          )
        },
        action
      );

    case "EXCLUDE_CANDIDATE":
      return withAudit(
        {
          ...state,
          candidates: state.candidates.map((candidate) =>
            candidate.id === action.candidateId ? { ...candidate, status: "excluded" } : candidate
          )
        },
        action
      );

    case "CONFIRM_CANDIDATES": {
      const selectedCandidateIds = new Set(
        (action.selectedCandidateIds ?? state.candidates.filter((candidate) => candidate.status !== "excluded").map((candidate) => candidate.id)).filter(
          (candidateId) => state.candidates.some((candidate) => candidate.id === candidateId && candidate.status !== "excluded")
        )
      );
      const selectedWorkflowCandidateIds = state.candidates
        .filter((candidate) => candidate.type === "workflow_event" && selectedCandidateIds.has(candidate.id))
        .map((candidate) => candidate.id);
      const selectedMetricCandidateIds = state.candidates
        .filter((candidate) => candidate.type === "metric" && selectedCandidateIds.has(candidate.id))
        .map((candidate) => candidate.id);
      if (!workflowsHaveSelectedMetrics(selectedWorkflowCandidateIds, selectedMetricCandidateIds)) {
        return {
          ...state,
          permissionDenied: "선택한 업무 흐름마다 연결 지표를 하나 이상 포함해야 합니다."
        };
      }
      const confirmedOperationalData = operationalDataForCandidates(selectedCandidateIds, state.candidates);
      const managedObjectTypes = mergeDomainTypes(
        "managed_object",
        state.managedObjectTypes,
        inferDomainTypes("managed_object", confirmedOperationalData.entities.map((entity) => entity.kind))
      );
      const workflowTypes = mergeDomainTypes(
        "workflow",
        state.workflowTypes,
        inferDomainTypes("workflow", confirmedOperationalData.events.map((event) => event.workflowType))
      );

      return withAudit(
        {
          ...state,
          screen: "dashboard",
          managedObjectTypes,
          workflowTypes,
          entities: confirmedOperationalData.entities,
          events: confirmedOperationalData.events,
          relations: confirmedOperationalData.relations,
          metricDefinitions: confirmedOperationalData.metricDefinitions,
          metricValues: confirmedOperationalData.metricValues,
          workflowMetricBindings: confirmedOperationalData.workflowMetricBindings,
          insights: confirmedOperationalData.insights,
          activeInsightId: confirmedOperationalData.insights[0]?.id ?? "",
          activeProposalId: "",
          selection: confirmedOperationalData.selection,
          scope: confirmedOperationalData.scope,
          navigationFocus: undefined,
          candidates: state.candidates.map((candidate) => (selectedCandidateIds.has(candidate.id) ? { ...candidate, status: "confirmed" } : { ...candidate, status: "excluded" })),
          analysisJobs: state.analysisJobs.map((job) =>
            job.id === "analysis-job-main" ? { ...job, status: "completed", progress: 100, currentStep: "운영 데이터 반영 완료" } : job
          )
        },
        action
      );
    }

    case "CREATE_PROPOSAL_FROM_INSIGHT": {
      const existing = state.proposals.find((proposal) => proposal.insightId === action.insightId);
      if (existing) {
        return {
          ...state,
          screen: "proposalVote",
          activeProposalId: existing.id,
          navigationFocus: { screen: "proposalVote", focusId: existing.id, label: existing.title }
        };
      }

      const insight = state.insights.find((item) => item.id === action.insightId);
      if (!insight) {
        return state;
      }
      const eligibleVoterIds = activeWorkspaceMembers(state, state.session.workspaceId)
        .filter((member) => member.eligibleVoter)
        .map((member) => member.userId);
      const proposal: Proposal = buildProposalDraftFromInsight({
        authorId: state.session.currentUserId,
        createdAt: at(action),
        eligibleVoterIds: eligibleVoterIds.length > 0 ? eligibleVoterIds : [state.session.currentUserId],
        insight
      });

      return withAudit(
        {
          ...state,
          screen: "proposalVote",
          activeProposalId: proposal.id,
          navigationFocus: { screen: "proposalVote", focusId: proposal.id, label: proposal.title },
          proposals: [proposal, ...state.proposals],
          insights: state.insights.map((insight) =>
            insight.id === action.insightId ? { ...insight, status: "proposal_created", proposalId: proposal.id } : insight
          )
        },
        action
      );
    }

    case "CAST_VOTE":
      return withAudit(
        {
          ...state,
          votes: [
            ...state.votes.filter(
              (vote) => !(vote.proposalId === action.proposalId && vote.voterId === state.session.currentUserId)
            ),
            {
              id: `vote-${state.session.currentUserId}`,
              proposalId: action.proposalId,
              voterId: state.session.currentUserId,
              choice: action.choice,
              reason: action.reason,
              votedAt: at(action)
            }
          ]
        },
        action
      );

    case "FINALIZE_PROPOSAL": {
      const proposal = state.proposals.find((item) => item.id === action.proposalId);
      if (!proposal) {
        return state;
      }

      const summary = summarizeVotes(proposal, state.votes);
      if (!summary.passed) {
        return {
          ...state,
          permissionDenied: "정족수 또는 승인 기준이 아직 충족되지 않아 결과를 확정할 수 없습니다."
        };
      }

      const decision: Decision = {
        id: decisionIdForProposal(proposal.id),
        proposalId: proposal.id,
        title: proposal.title,
        result: "approved",
        finalizedAt: at(action),
        summary: "투표 기준이 충족되어 운영 조정안이 최종 확정되었습니다."
      };

      return withAudit(
        {
          ...state,
          screen: "decisionConfirm",
          navigationFocus: undefined,
          decisions: [decision, ...state.decisions],
          activeProposalId: proposal.id,
          proposals: state.proposals.map((item) =>
            item.id === proposal.id
              ? { ...item, status: "finalized", finalizedAt: decision.finalizedAt, decisionId: decision.id }
              : item
          ),
          entities: state.entities.map((entity) =>
            entity.insightIds.includes(proposal.insightId) ? { ...entity, decisionIds: [decision.id, ...entity.decisionIds] } : entity
          )
        },
        action
      );
    }

    case "ADD_VERIFICATION":
      return withAudit(
        {
          ...state,
          screen: "verificationDetail",
          verificationRecords: [action.record, ...state.verificationRecords],
          decisions: state.decisions.map((decision) =>
            decision.id === action.record.decisionId ? { ...decision, canonicalHash: action.record.hash } : decision
          ),
          proposals: state.proposals.map((proposal) =>
            proposal.decisionId === action.record.decisionId ? { ...proposal, status: "verified" } : proposal
          )
        },
        action
      );

    case "RECORD_OUTCOME": {
      const proposal = state.proposals.find((item) => item.decisionId === action.decisionId);
      const outcome: OutcomeRecord = {
        id: `outcome-${action.decisionId.replace(/^decision-/, "")}`,
        decisionId: action.decisionId,
        beforeMetricValue: action.beforeMetricValue,
        afterMetricValue: action.afterMetricValue,
        status: "reanalyzed",
        summary: action.summary,
        recordedAt: at(action)
      };

      return withAudit(
        {
          ...state,
          screen: "outcome",
          navigationFocus: undefined,
          outcomes: [outcome, ...state.outcomes],
          insights: state.insights.map((insight) =>
            insight.id === proposal?.insightId ? { ...insight, status: "resolved" } : insight
          ),
          notifications: [
            {
              id: action.notificationId ?? "notice-outcome",
              level: "success",
              message: "결과 기록을 반영하고 인공지능 재분석을 완료했습니다."
            },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "SET_PERMISSION_DENIED":
      return { ...state, permissionDenied: action.message };

    case "SET_SIMULATED_ERROR":
      return { ...state, simulatedError: action.message };

    default:
      return state;
  }
}
