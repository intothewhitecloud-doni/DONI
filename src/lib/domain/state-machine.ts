import { summarizeVotes } from "../policies/voting";
import {
  activeCompanyUserForUser,
  actorCompanyUserForTarget,
  canFinalizeProposal,
  canManageCompanyUser,
  canVoteOnProposal,
  normalizeLegacyRole,
  proposalVoterUserIds
} from "./policy";
import { initialPrototypeState as preparedData } from "./mock-data";
import { buildCompanyResultBundle, buildProposalDraftFromInsight, decisionIdForProposal, workflowsHaveSelectedMetrics } from "./result-scenarios";
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
  ActorSnapshot,
  AnalysisJob,
  AuthAccount,
  AuditLog,
  CandidateType,
  Company,
  CompanyOperationalState,
  CompanyUser,
  Decision,
  DomainTypeDefinition,
  DomainTypeScope,
  LinkTarget,
  OrganizationCategory,
  OutcomeRecord,
  Proposal,
  PrototypeState,
  Role,
  Screen,
  SourceFile,
  User,
  VerificationRecord,
  VoteChoice
} from "./types";
import { UNASSIGNED_ORGANIZATION_CATEGORY_ID } from "./types";

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
    | { type: "REGISTER_ACCOUNT"; account: AuthAccount; companyUser: CompanyUser; user: User }
    | { type: "UPDATE_COMPANY"; name: string }
    | { type: "REGENERATE_COMPANY_CODE"; code: string }
    | { type: "UPDATE_COMPANY_USER"; companyUserId: string; role: Role; title: string; organizationCategoryId: string }
    | { type: "APPROVE_COMPANY_USER"; companyUserId: string }
    | { type: "REJECT_COMPANY_USER"; companyUserId: string }
    | { type: "DELETE_COMPANY_USER_ACCOUNT"; companyUserId: string }
    | { type: "ADD_ORGANIZATION_CATEGORY"; name: string }
    | { type: "UPDATE_ORGANIZATION_CATEGORY"; organizationCategoryId: string; name: string }
    | { type: "DELETE_ORGANIZATION_CATEGORY"; organizationCategoryId: string }
    | { type: "SET_CANDIDATE_TYPE"; candidateType: CandidateType }
    | { type: "ADD_SOURCE_FILES"; files: SourceFile[]; organizationCategoryId?: string }
    | { type: "UPDATE_SOURCE_FILE"; fileId: string; patch: Pick<SourceFile, "kind" | "name"> & { organizationCategoryId?: string } }
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

  return buildCompanyResultBundle({
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
  CompanyOperationalState,
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

export function createEmptyCompanyData(company: Company): CompanyOperationalState {
  return {
    company,
    companyUsers: [],
    organizationCategories: [{ id: UNASSIGNED_ORGANIZATION_CATEGORY_ID, name: "미지정" }],
    ...structuredClone(emptyOperationalCollections),
    activeCandidateType: "managed_object",
    activeInsightId: "",
    activeProposalId: "",
    selection: undefined,
    scope: undefined
  };
}

export function companyDataFromState(state: PrototypeState): CompanyOperationalState {
  return {
    company: state.company,
    companyUsers: state.companyUsers,
    organizationCategories: state.organizationCategories,
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

export function currentCompanyData(state: PrototypeState): CompanyOperationalState {
  return companyDataFromState(state);
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

function normalizeMetricValues(metricValues: CompanyOperationalState["metricValues"]): CompanyOperationalState["metricValues"] {
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

function isLegacyClaimRateTimeSeries(metricValue: CompanyOperationalState["metricValues"][number]): boolean {
  return (
    metricValue.id === "metric-value-claim" &&
    metricValue.metricId === "metric-claim-rate" &&
    metricValue.chartType === "time_series" &&
    metricValue.series.length > 0 &&
    metricValue.series.every((point) => !point.observedAt)
  );
}

function sortMetricSeriesPoints(points: CompanyOperationalState["metricValues"][number]["series"]) {
  return [...points].sort((left, right) => {
    const leftTime = left.observedAt ? Date.parse(left.observedAt) : Number.NaN;
    const rightTime = right.observedAt ? Date.parse(right.observedAt) : Number.NaN;

    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) {
      return leftTime - rightTime;
    }

    return left.label.localeCompare(right.label);
  });
}

export function normalizeCompanyData(data: CompanyOperationalState): CompanyOperationalState {
  return {
    ...data,
    organizationCategories: normalizeOrganizationCategories(data.organizationCategories),
    sourceFiles: data.sourceFiles.map(normalizeSourceFile),
    managedObjectTypes: normalizeDomainTypeCatalog(
      data.managedObjectTypes ?? inferDomainTypes("managed_object", data.entities.map((entity) => entity.kind)),
      "managed_object"
    ),
    workflowTypes: normalizeDomainTypeCatalog(
      data.workflowTypes ?? inferDomainTypes("workflow", data.events.map((event) => event.workflowType)),
      "workflow"
    ),
    metricValues: normalizeMetricValues(data.metricValues ?? []),
    workflowMetricBindings: data.workflowMetricBindings ?? []
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

function actorSnapshotForUser(state: Pick<PrototypeState, "companyUsers" | "users">, userId?: string): ActorSnapshot {
  const companyUser = userId ? activeCompanyUserForUser(state, userId) ?? state.companyUsers.find((item) => item.userId === userId) : undefined;
  const user = userId ? state.users.find((item) => item.id === userId) : undefined;
  return {
    userId,
    name: companyUser?.name ?? user?.name ?? "시스템",
    role: companyUser?.role ?? user?.role ?? "system"
  };
}

function actorSnapshot(state: PrototypeState): ActorSnapshot {
  return actorSnapshotForUser(state, state.session.currentUserId);
}

function withAudit(state: PrototypeState, action: ActionMeta): PrototypeState {
  if (!action.auditLog) {
    return state;
  }

  const auditLog: AuditLog = {
    ...action.auditLog,
    actorSnapshot: action.auditLog.actorSnapshot ?? actorSnapshotForUser(state, action.auditLog.actorId)
  };
  return { ...state, auditLogs: [auditLog, ...state.auditLogs] };
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

  return withTypeCatalog(state, scope, [
    ...catalog,
    {
      id: domainTypeId(scope, normalizedLabel, catalog.map((item) => item.id)),
      scope,
      label: normalizedLabel,
      color: normalizeTypeColor(color ?? defaultTypeColor(catalog.length))
    }
  ]);
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

function categoryIdExists(categories: OrganizationCategory[], categoryId: string): boolean {
  return categories.some((category) => category.id === categoryId);
}

function normalizeCategoryId(state: Pick<PrototypeState, "organizationCategories">, categoryId?: string): string {
  if (categoryId && categoryIdExists(state.organizationCategories, categoryId)) {
    return categoryId;
  }

  return UNASSIGNED_ORGANIZATION_CATEGORY_ID;
}

function normalizeOrganizationCategories(categories: OrganizationCategory[]): OrganizationCategory[] {
  const deduped = new Map<string, OrganizationCategory>();
  deduped.set(UNASSIGNED_ORGANIZATION_CATEGORY_ID, { id: UNASSIGNED_ORGANIZATION_CATEGORY_ID, name: "미지정" });
  categories.forEach((category) => {
    const name = category.name.trim();
    if (category.id && name && category.id !== UNASSIGNED_ORGANIZATION_CATEGORY_ID) {
      deduped.set(category.id, { id: category.id, name });
    }
  });
  return Array.from(deduped.values());
}

function organizationCategoryIdForName(name: string, existingIds: string[]): string {
  const stem = name.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "") || "category";
  let id = `org-${stem}`;
  let index = 2;
  while (existingIds.includes(id)) {
    id = `org-${stem}-${index}`;
    index += 1;
  }
  return id;
}

function normalizeSourceFile(file: SourceFile): SourceFile {
  return {
    ...file,
    organizationCategoryId: file.organizationCategoryId ?? UNASSIGNED_ORGANIZATION_CATEGORY_ID
  };
}

function upsertCompanyUser(state: PrototypeState, companyUser: CompanyUser): CompanyUser[] {
  return [companyUser, ...state.companyUsers.filter((item) => item.id !== companyUser.id && item.userId !== companyUser.userId)];
}

function isActiveCompanyOwner(state: PrototypeState): boolean {
  if (!state.session.loggedIn || !state.session.currentUserId) {
    return false;
  }

  const companyUser = activeCompanyUserForUser(state, state.session.currentUserId);
  return companyUser?.role === "owner";
}

function denyCompanyOwnerMutation(state: PrototypeState): PrototypeState {
  return { ...state, permissionDenied: "현재 역할은 기업 정보를 변경할 수 없습니다." };
}

function snapshotRecordsForRemovedUser(state: PrototypeState, userId: string): Pick<PrototypeState, "auditLogs" | "decisions" | "outcomes" | "proposals" | "votes"> {
  const snapshot = actorSnapshotForUser(state, userId);
  return {
    auditLogs: state.auditLogs.map((log) => log.actorId === userId && !log.actorSnapshot ? { ...log, actorSnapshot: snapshot } : log),
    decisions: state.decisions,
    outcomes: state.outcomes,
    proposals: state.proposals.map((proposal) => {
      const deletedUserWasVoter = proposal.voterUserIds.includes(userId);
      return {
        ...proposal,
        voterSnapshots: proposal.voterSnapshots ?? (deletedUserWasVoter ? proposal.voterUserIds.map((voterId) => actorSnapshotForUser(state, voterId)) : undefined),
        comments: proposal.comments.map((comment) =>
          comment.authorId === userId && !comment.authorSnapshot ? { ...comment, authorSnapshot: snapshot } : comment
        )
      };
    }),
    votes: state.votes.map((vote) => vote.voterId === userId && !vote.voterSnapshot ? { ...vote, voterSnapshot: snapshot } : vote)
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

    case "LOGIN": {
      const companyUser = activeCompanyUserForUser(state, action.userId);
      if (!companyUser) {
        return withAudit(
          {
            ...state,
            session: {
              ...state.session,
              currentUserId: action.userId,
              loggedIn: false,
              role: action.role
            },
            screen: "login",
            navigationFocus: undefined,
            permissionDenied: "가입 신청이 승인되면 접속할 수 있습니다.",
            simulatedError: undefined
          },
          action
        );
      }

      return withAudit(
        {
          ...state,
          session: {
            ...state.session,
            currentUserId: action.userId,
            loggedIn: true,
            role: companyUser.role
          },
          screen: "dashboard",
          navigationFocus: undefined,
          permissionDenied: undefined,
          simulatedError: undefined
        },
        action
      );
    }

    case "RESTORE_USER_STATE": {
      const restoredUser = action.state.users.find((user) => user.id === action.userId);
      const restoredCompanyUser = activeCompanyUserForUser(action.state, action.userId);
      const restoredState: PrototypeState = {
        ...state,
        ...normalizeCompanyData(action.state),
        screen: restoredCompanyUser ? action.screen : "login",
        session: {
          ...action.state.session,
          currentUserId: action.userId,
          loggedIn: Boolean(restoredCompanyUser),
          role: restoredCompanyUser?.role ?? normalizeLegacyRole(restoredUser?.role ?? action.role)
        },
        authAccounts: action.state.authAccounts.length > 0 ? action.state.authAccounts : state.authAccounts,
        users: action.state.users.length > 0 ? action.state.users : state.users,
        navigationFocus: undefined,
        permissionDenied: restoredCompanyUser ? undefined : "가입 신청이 승인되면 접속할 수 있습니다.",
        simulatedError: undefined
      };
      return withAudit(restoredState, action);
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

    case "REGISTER_ACCOUNT": {
      const nextState = {
        ...state,
        authAccounts: [action.account, ...state.authAccounts.filter((account) => account.userId !== action.account.userId)],
        users: [action.user, ...state.users.filter((user) => user.id !== action.user.id)],
        companyUsers: upsertCompanyUser(state, action.companyUser),
        screen: "login" as Screen,
        navigationFocus: undefined,
        session: {
          ...state.session,
          currentUserId: action.user.id,
          loggedIn: false,
          role: action.user.role
        },
        notifications: [
          {
            id: action.notificationId ?? "notice-account-registration",
            level: "info" as const,
            message: "가입 신청이 등록되었습니다. 승인 완료 후 접속할 수 있습니다."
          },
          ...state.notifications
        ],
        permissionDenied: "가입 신청이 승인되면 접속할 수 있습니다.",
        simulatedError: undefined
      };

      return withAudit(nextState, action);
    }

    case "UPDATE_COMPANY":
      if (!isActiveCompanyOwner(state)) {
        return denyCompanyOwnerMutation(state);
      }

      return withAudit(
        {
          ...state,
          company: { ...state.company, name: action.name },
          notifications: [
            { id: action.notificationId ?? "notice-company-update", level: "success", message: "기업 정보를 수정했습니다." },
            ...state.notifications
          ]
        },
        action
      );

    case "REGENERATE_COMPANY_CODE":
      if (!isActiveCompanyOwner(state)) {
        return denyCompanyOwnerMutation(state);
      }

      return withAudit(
        {
          ...state,
          company: { ...state.company, code: action.code },
          notifications: [
            { id: action.notificationId ?? "notice-company-code", level: "success", message: "기업 코드가 새로 발급되었습니다." },
            ...state.notifications
          ]
        },
        action
      );

    case "UPDATE_COMPANY_USER": {
      const target = state.companyUsers.find((companyUser) => companyUser.id === action.companyUserId);
      const actor = actorCompanyUserForTarget(state, target);
      const roleChanged = Boolean(target && target.role !== action.role);
      const titleChanged = Boolean(target && target.title !== action.title);
      const categoryChanged = Boolean(target && target.organizationCategoryId !== action.organizationCategoryId);
      const canUpdateRole = !roleChanged || canManageCompanyUser(actor, target, "update_role", action.role);
      const canUpdateTitle = !titleChanged || canManageCompanyUser(actor, target, "update_title");
      const canAssignCategory = !categoryChanged || canManageCompanyUser(actor, target, "assign_category");
      if (!target || !canUpdateRole || !canUpdateTitle || !canAssignCategory) {
        return { ...state, permissionDenied: "현재 역할은 해당 사용자 정보를 변경할 수 없습니다." };
      }

      return withAudit(
        {
          ...state,
          companyUsers: state.companyUsers.map((companyUser) =>
            companyUser.id === action.companyUserId
              ? {
                  ...companyUser,
                  role: action.role,
                  title: action.title,
                  organizationCategoryId: normalizeCategoryId(state, action.organizationCategoryId)
                }
              : companyUser
          ),
          notifications: [
            { id: action.notificationId ?? "notice-company-user-update", level: "success", message: "사용자 정보를 수정했습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "APPROVE_COMPANY_USER": {
      const target = state.companyUsers.find((companyUser) => companyUser.id === action.companyUserId);
      const actor = actorCompanyUserForTarget(state, target);
      if (!canManageCompanyUser(actor, target, "approve")) {
        return { ...state, permissionDenied: "현재 역할은 해당 가입 신청을 승인할 수 없습니다." };
      }

      return withAudit(
        {
          ...state,
          companyUsers: state.companyUsers.map((companyUser) =>
            companyUser.id === action.companyUserId ? { ...companyUser, status: "active" as const } : companyUser
          ),
          notifications: [
            { id: action.notificationId ?? "notice-company-user-approve", level: "success", message: "가입 신청을 승인했습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "REJECT_COMPANY_USER": {
      const target = state.companyUsers.find((companyUser) => companyUser.id === action.companyUserId);
      const actor = actorCompanyUserForTarget(state, target);
      if (!canManageCompanyUser(actor, target, "reject")) {
        return { ...state, permissionDenied: "현재 역할은 해당 가입 신청을 반려할 수 없습니다." };
      }

      return withAudit(
        {
          ...state,
          companyUsers: state.companyUsers.map((companyUser) =>
            companyUser.id === action.companyUserId ? { ...companyUser, status: "rejected" as const } : companyUser
          ),
          notifications: [
            { id: action.notificationId ?? "notice-company-user-reject", level: "warning", message: "가입 신청을 반려했습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "DELETE_COMPANY_USER_ACCOUNT": {
      const target = state.companyUsers.find((companyUser) => companyUser.id === action.companyUserId);
      const actor = actorCompanyUserForTarget(state, target);
      if (!target || !canManageCompanyUser(actor, target, "delete_account")) {
        return { ...state, permissionDenied: "현재 역할은 해당 사용자 계정을 삭제할 수 없습니다." };
      }

      const snapshots = snapshotRecordsForRemovedUser(state, target.userId);
      return withAudit(
        {
          ...state,
          ...snapshots,
          authAccounts: state.authAccounts.filter((account) => account.userId !== target.userId),
          users: state.users.filter((user) => user.id !== target.userId),
          companyUsers: state.companyUsers.filter((companyUser) => companyUser.id !== action.companyUserId),
          notifications: [
            { id: action.notificationId ?? "notice-company-user-delete", level: "info", message: "사용자 계정을 삭제했습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "ADD_ORGANIZATION_CATEGORY": {
      if (!isActiveCompanyOwner(state)) {
        return denyCompanyOwnerMutation(state);
      }

      const name = action.name.trim();
      if (!name) {
        return { ...state, permissionDenied: "조직 이름을 입력해 주세요." };
      }

      if (state.organizationCategories.some((category) => normalizeTypeLabel(category.name) === normalizeTypeLabel(name))) {
        return { ...state, permissionDenied: "이미 등록된 조직입니다." };
      }

      const id = organizationCategoryIdForName(name, state.organizationCategories.map((category) => category.id));
      return withAudit(
        {
          ...state,
          organizationCategories: [...state.organizationCategories, { id, name }],
          notifications: [
            { id: action.notificationId ?? "notice-organization-category-add", level: "success", message: "조직을 추가했습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "UPDATE_ORGANIZATION_CATEGORY": {
      if (!isActiveCompanyOwner(state)) {
        return denyCompanyOwnerMutation(state);
      }

      if (action.organizationCategoryId === UNASSIGNED_ORGANIZATION_CATEGORY_ID) {
        return { ...state, permissionDenied: "미지정 조직은 수정할 수 없습니다." };
      }
      const name = action.name.trim();
      if (!name) {
        return { ...state, permissionDenied: "조직 이름을 입력해 주세요." };
      }
      if (
        state.organizationCategories.some(
          (category) =>
            category.id !== action.organizationCategoryId &&
            normalizeTypeLabel(category.name) === normalizeTypeLabel(name)
        )
      ) {
        return { ...state, permissionDenied: "이미 등록된 조직입니다." };
      }
      return withAudit(
        {
          ...state,
          organizationCategories: normalizeOrganizationCategories(
            state.organizationCategories.map((category) =>
              category.id === action.organizationCategoryId ? { ...category, name } : category
            )
          ),
          notifications: [
            { id: action.notificationId ?? "notice-organization-category-update", level: "success", message: "조직을 수정했습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "DELETE_ORGANIZATION_CATEGORY": {
      if (!isActiveCompanyOwner(state)) {
        return denyCompanyOwnerMutation(state);
      }

      if (action.organizationCategoryId === UNASSIGNED_ORGANIZATION_CATEGORY_ID) {
        return { ...state, permissionDenied: "미지정 조직은 삭제할 수 없습니다." };
      }

      return withAudit(
        {
          ...state,
          organizationCategories: normalizeOrganizationCategories(
            state.organizationCategories.filter((category) => category.id !== action.organizationCategoryId)
          ),
          companyUsers: state.companyUsers.map((companyUser) =>
            companyUser.organizationCategoryId === action.organizationCategoryId
              ? { ...companyUser, organizationCategoryId: UNASSIGNED_ORGANIZATION_CATEGORY_ID }
              : companyUser
          ),
          sourceFiles: state.sourceFiles.map((file) =>
            file.organizationCategoryId === action.organizationCategoryId
              ? { ...file, organizationCategoryId: UNASSIGNED_ORGANIZATION_CATEGORY_ID }
              : file
          ),
          notifications: [
            { id: action.notificationId ?? "notice-organization-category-delete", level: "info", message: "조직을 삭제했습니다. 연결된 사용자와 파일은 미지정으로 이동했습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "SET_CANDIDATE_TYPE":
      return { ...state, activeCandidateType: action.candidateType };

    case "ADD_SOURCE_FILES": {
      const categoryId = normalizeCategoryId(state, action.organizationCategoryId);
      const incoming = action.files.map((file) => ({ ...normalizeSourceFile(file), organizationCategoryId: categoryId }));
      const incomingIds = new Set(incoming.map((file) => file.id));
      const incomingNameKeys = new Set(incoming.map((file) => file.name.trim().toLowerCase()));
      return withAudit(
        {
          ...state,
          screen: "vault",
          sourceFiles: [
            ...incoming.map((file) => ({ ...file, status: "ready" as const, uploadedAt: undefined })),
            ...state.sourceFiles
              .filter((file) => !incomingIds.has(file.id) && !incomingNameKeys.has(file.name.trim().toLowerCase()))
              .map((file) => ({ ...normalizeSourceFile(file), status: "ready" as const, uploadedAt: undefined }))
          ],
          notifications: [
            { id: action.notificationId ?? "notice-source-files", level: "success", message: "파일이 데이터 보관함에 추가되었습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "UPDATE_SOURCE_FILE":
      return withAudit(
        {
          ...state,
          sourceFiles: state.sourceFiles.map((file) =>
            file.id === action.fileId
              ? { ...normalizeSourceFile(file), ...action.patch, organizationCategoryId: normalizeCategoryId(state, action.patch.organizationCategoryId ?? file.organizationCategoryId), status: "ready" as const, uploadedAt: undefined }
              : { ...normalizeSourceFile(file), status: "ready" as const, uploadedAt: undefined }
          ),
          notifications: [
            { id: action.notificationId ?? "notice-source-file-update", level: "success", message: "파일 정보가 수정되었습니다." },
            ...state.notifications
          ]
        },
        action
      );

    case "REMOVE_SOURCE_FILE":
      return withAudit(
        {
          ...state,
          sourceFiles: state.sourceFiles
            .filter((file) => file.id !== action.fileId)
            .map((file) => ({ ...normalizeSourceFile(file), status: "ready" as const, uploadedAt: undefined })),
          notifications: [
            { id: action.notificationId ?? "notice-source-file-remove", level: "info", message: "파일이 데이터 보관함에서 제거되었습니다." },
            ...state.notifications
          ]
        },
        action
      );

    case "ADD_DOMAIN_TYPE": {
      if (!isActiveCompanyOwner(state)) {
        return denyCompanyOwnerMutation(state);
      }

      const next = addDomainType(state, action.scope, action.label, action.color);
      if (next.permissionDenied) {
        return next;
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
      if (!isActiveCompanyOwner(state)) {
        return denyCompanyOwnerMutation(state);
      }

      const next = updateDomainType(state, action.scope, action.typeId, action.label, action.color);
      if (next.permissionDenied) {
        return next;
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
      if (!isActiveCompanyOwner(state)) {
        return denyCompanyOwnerMutation(state);
      }

      const next = deleteDomainType(state, action.scope, action.typeId);
      if (next.permissionDenied) {
        return next;
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
          sourceFiles: sourceFiles.map((file) => ({ ...normalizeSourceFile(file), status: "uploaded", uploadedAt })),
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
          sourceFiles: sourceFiles.map((file) => ({ ...normalizeSourceFile(file), status: "parsed" }))
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

      return nextStep.status === "reviewing_ready" ? { ...next, screen: "review" } : next;
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
      const voterUserIds = proposalVoterUserIds(state);
      const proposal: Proposal = {
        ...buildProposalDraftFromInsight({
          authorId: state.session.currentUserId,
          createdAt: at(action),
          voterUserIds: voterUserIds.length > 0 ? voterUserIds : [state.session.currentUserId],
          insight
        }),
        voterSnapshots: voterUserIds.map((userId) => actorSnapshotForUser(state, userId))
      };

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
      if (!canVoteOnProposal(state, action.proposalId)) {
        return { ...state, permissionDenied: "현재 역할은 이 안건 투표에 참여할 수 없습니다." };
      }

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
              voterSnapshot: actorSnapshot(state),
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

      if (!canFinalizeProposal(state)) {
        return { ...state, permissionDenied: "현재 역할은 의사결정 결과를 확정할 수 없습니다." };
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
        summary: "투표 기준이 충족되어 운영 조정안이 최종 확정되었습니다.",
        actorSnapshot: actorSnapshot(state)
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
        recordedAt: at(action),
        actorSnapshot: actorSnapshot(state)
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
