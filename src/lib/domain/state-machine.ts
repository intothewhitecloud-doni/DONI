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
  StructureMapNodePatch,
  StructureMapRelationInput,
  StructureMapRelationPatch,
  StructureMapViewState,
  SourceFile,
  User,
  VerificationRecord,
  VoteChoice
} from "./types";
import {
  createDefaultStructureMapViewState,
  defaultStructureMapEdgeTypes,
  defaultStructureMapLayoutModes,
  defaultStructureMapNodeTypes,
  UNASSIGNED_ORGANIZATION_CATEGORY_ID
} from "./types";

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
    | { type: "UPDATE_SOURCE_FILE"; fileId: string; patch: Pick<SourceFile, "kind" | "name"> & Partial<Pick<SourceFile, "description">> & { organizationCategoryId?: string } }
    | { type: "APPLY_SOURCE_FILE_TO_CURRENT_STANDARD"; fileId: string }
    | { type: "REMOVE_SOURCE_FILE"; fileId: string }
    | { type: "SET_STRUCTURE_MAP_VIEW"; patch: Partial<StructureMapViewState> }
    | { type: "UPDATE_STRUCTURE_MAP_NODE"; nodeId: string; patch: StructureMapNodePatch }
    | { type: "UPDATE_STRUCTURE_MAP_RELATION"; relationId: string; patch: StructureMapRelationPatch }
    | { type: "ADD_STRUCTURE_MAP_RELATION"; relation: StructureMapRelationInput }
    | { type: "DELETE_STRUCTURE_MAP_RELATION"; relationId: string }
    | { type: "HIDE_STRUCTURE_MAP_ITEM"; itemId: string; kind: "node" | "edge" }
    | { type: "UNHIDE_STRUCTURE_MAP_ITEM"; itemId: string; kind: "node" | "edge" }
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

export function normalizeStructureMapViewState(view?: Partial<StructureMapViewState>): StructureMapViewState {
  const defaults = createDefaultStructureMapViewState();
  const nodeTypeSet = new Set(defaultStructureMapNodeTypes);
  const edgeTypeSet = new Set(defaultStructureMapEdgeTypes);
  const depth = view?.depth === 1 || view?.depth === 2 || view?.depth === 3 || view?.depth === "all" ? view.depth : defaults.depth;
  const layoutMode =
    view?.layoutMode === "semantic-lanes" || view?.layoutMode === "clustered" || view?.layoutMode === "risk-first"
      ? view.layoutMode
      : defaults.layoutMode;
  const savedPositions = normalizeStructureMapSavedPositions(view?.savedPositions);

  return {
    searchQuery: typeof view?.searchQuery === "string" ? view.searchQuery : defaults.searchQuery,
    nodeTypes: Array.isArray(view?.nodeTypes) ? view.nodeTypes.filter((type) => nodeTypeSet.has(type)) : defaults.nodeTypes,
    edgeTypes: Array.isArray(view?.edgeTypes) ? view.edgeTypes.filter((type) => edgeTypeSet.has(type)) : defaults.edgeTypes,
    depth,
    layoutMode,
    selectedItemId: typeof view?.selectedItemId === "string" ? view.selectedItemId : undefined,
    hiddenNodeIds: Array.isArray(view?.hiddenNodeIds) ? Array.from(new Set(view.hiddenNodeIds.filter((id) => typeof id === "string"))) : defaults.hiddenNodeIds,
    hiddenEdgeIds: Array.isArray(view?.hiddenEdgeIds) ? Array.from(new Set(view.hiddenEdgeIds.filter((id) => typeof id === "string"))) : defaults.hiddenEdgeIds,
    savedPositions
  };
}

function isStructureMapPoint(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { x?: unknown }).x === "number" &&
    Number.isFinite((value as { x: number }).x) &&
    typeof (value as { y?: unknown }).y === "number" &&
    Number.isFinite((value as { y: number }).y)
  );
}

function normalizeStructureMapPositionMap(value: unknown): Record<string, { x: number; y: number }> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, { x: number; y: number }] => isStructureMapPoint(entry[1])));
}

function normalizeStructureMapSavedPositions(value: unknown): StructureMapViewState["savedPositions"] {
  const defaults = createDefaultStructureMapViewState().savedPositions;
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const entries = Object.entries(value);
  const looksLikeLegacyFlatMap = entries.some(([, position]) => isStructureMapPoint(position));
  if (looksLikeLegacyFlatMap) {
    return {
      ...defaults,
      "semantic-lanes": normalizeStructureMapPositionMap(value)
    };
  }

  return Object.fromEntries(
    defaultStructureMapLayoutModes.map((mode) => [mode, normalizeStructureMapPositionMap((value as Partial<StructureMapViewState["savedPositions"]>)[mode])])
  ) as StructureMapViewState["savedPositions"];
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
    description: file.description?.trim() || `${file.name} 업로드 원천 데이터입니다.`,
    organizationCategoryId: file.organizationCategoryId ?? UNASSIGNED_ORGANIZATION_CATEGORY_ID
  };
}

type SourceFileOperationalIds = {
  applyEventId: string;
  correctionEventId: string;
  entityId: string;
  evidenceId: string;
  insightId: string;
  metricId: string;
  metricValueId: string;
  relationId: string;
  uploadEventId: string;
  workflowMetricBindingId: string;
};

function sourceFileOperationalIds(fileId: string): SourceFileOperationalIds {
  const stem = fileId.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "") || "source-file";
  return {
    applyEventId: `event-${stem}-apply`,
    correctionEventId: `event-${stem}-correction`,
    entityId: `entity-${stem}`,
    evidenceId: `evidence-${stem}-profile`,
    insightId: `insight-${stem}-lineage`,
    metricId: `metric-${stem}-readiness`,
    metricValueId: `metric-value-${stem}-readiness`,
    relationId: `relation-${stem}-current-standard`,
    uploadEventId: `event-${stem}-upload`,
    workflowMetricBindingId: `binding-${stem}-readiness`
  };
}

function sourceFileDataName(file: SourceFile): string {
  return file.name.replace(/\.[^.]+$/, "") || file.name;
}

function sourceFileFieldNames(file: SourceFile): string[] {
  const previewFields = file.previewColumns?.map((field) => field.trim()).filter(Boolean) ?? [];
  if (previewFields.length > 0) {
    return previewFields.slice(0, 8);
  }

  return ["데이터명", "설명", "데이터 유형", "담당 부서"];
}

function organizationCategoryNameForSourceFile(state: PrototypeState, file: SourceFile): string {
  const categoryId = file.organizationCategoryId ?? UNASSIGNED_ORGANIZATION_CATEGORY_ID;
  return state.organizationCategories.find((category) => category.id === categoryId)?.name ?? "미지정";
}

function sourceFileReadinessScore(file: SourceFile): number {
  const fields = sourceFileFieldNames(file);
  const hasDescription = Boolean(file.description?.trim());
  const hasOwner = Boolean(file.organizationCategoryId && file.organizationCategoryId !== UNASSIGNED_ORGANIZATION_CATEGORY_ID);
  const hasPreview = Boolean(file.previewRows?.length || file.rowCount > 0);
  return Math.min(100, 50 + fields.length * 4 + (hasDescription ? 14 : 0) + (hasOwner ? 12 : 0) + (hasPreview ? 8 : 0));
}

function removeSourceFileOperationalData(state: PrototypeState, ids: SourceFileOperationalIds): PrototypeState {
  const evidenceIds = new Set([ids.evidenceId]);
  const entityIds = new Set([ids.entityId]);
  const eventIds = new Set([ids.uploadEventId, ids.correctionEventId, ids.applyEventId]);
  const relationIds = new Set([ids.relationId]);
  const metricIds = new Set([ids.metricId]);
  const metricValueIds = new Set([ids.metricValueId]);
  const bindingIds = new Set([ids.workflowMetricBindingId]);
  const insightIds = new Set([ids.insightId]);

  return {
    ...state,
    evidence: state.evidence.filter((item) => !evidenceIds.has(item.id)),
    entities: state.entities.filter((item) => !entityIds.has(item.id)),
    events: state.events.filter((item) => !eventIds.has(item.id)),
    insights: state.insights.filter((item) => !insightIds.has(item.id)),
    metricDefinitions: state.metricDefinitions.filter((item) => !metricIds.has(item.id)),
    metricValues: state.metricValues.filter((item) => !metricValueIds.has(item.id)),
    relations: state.relations.filter((item) => !relationIds.has(item.id)),
    workflowMetricBindings: state.workflowMetricBindings.filter((item) => !bindingIds.has(item.id))
  };
}

function applySourceFileOperationalData(state: PrototypeState, file: SourceFile, appliedAt: string): PrototypeState {
  const normalizedFile = normalizeSourceFile(file);
  const ids = sourceFileOperationalIds(normalizedFile.id);
  const cleared = removeSourceFileOperationalData(state, ids);
  const dataName = sourceFileDataName(normalizedFile);
  const owner = organizationCategoryNameForSourceFile(state, normalizedFile);
  const fields = sourceFileFieldNames(normalizedFile);
  const rowCount = Math.max(normalizedFile.rowCount, normalizedFile.previewRows?.length ?? 0);
  const rowCountLabel = rowCount > 0 ? `${rowCount.toLocaleString("ko-KR")}행` : "미리보기 기준";
  const readiness = sourceFileReadinessScore(normalizedFile);
  const description = normalizedFile.description ?? `${normalizedFile.name} 업로드 원천 데이터입니다.`;
  const uploadedAt = normalizedFile.uploadedAt ?? appliedAt;

  const evidence: PrototypeState["evidence"][number] = {
    id: ids.evidenceId,
    sourceFileId: normalizedFile.id,
    sourceKind: "vault_file",
    sourceName: normalizedFile.name,
    columns: fields,
    confidence: 0.82,
    label: `${dataName} 원천 프로필`,
    location: `${normalizedFile.name} / ${fields.slice(0, 4).join(", ")}`,
    excerpt: `${description} 담당 부서 ${owner}, 데이터 유형 ${normalizedFile.kind}, 데이터 규모 ${rowCountLabel} 기준으로 현재 기준 반영 관계를 생성했습니다.`
  };

  const entity: PrototypeState["entities"][number] = {
    id: ids.entityId,
    kind: normalizedFile.kind,
    name: dataName,
    owner,
    status: readiness >= 88 ? "반영 완료" : "보정 필요",
    summary: description,
    metricIds: [ids.metricId],
    relationIds: [ids.relationId],
    eventIds: [ids.uploadEventId, ids.correctionEventId, ids.applyEventId],
    insightIds: [ids.insightId],
    decisionIds: []
  };

  const events: PrototypeState["events"] = [
    {
      id: ids.uploadEventId,
      objectId: ids.entityId,
      workflowType: "원천 기록",
      name: "원천 기록 생성",
      occurredAt: uploadedAt,
      durationHours: 0.2,
      evidenceIds: [ids.evidenceId]
    },
    {
      id: ids.correctionEventId,
      objectId: ids.entityId,
      workflowType: "정보 보정",
      name: "정보 보정",
      occurredAt: appliedAt,
      durationHours: 0.4,
      evidenceIds: [ids.evidenceId]
    },
    {
      id: ids.applyEventId,
      objectId: ids.entityId,
      workflowType: "현재 기준 반영",
      name: "현재 기준 반영",
      occurredAt: appliedAt,
      durationHours: 0.3,
      evidenceIds: [ids.evidenceId]
    }
  ];

  const relation: PrototypeState["relations"][number] = {
    id: ids.relationId,
    fromId: ids.entityId,
    toId: ids.applyEventId,
    type: "현재 기준 반영 관계",
    relationKind: "lineage",
    confidence: 0.82,
    strength: readiness >= 88 ? "strong" : "medium",
    description: `${dataName} 데이터가 정보 보정 후 현재 기준 반영 업무흐름으로 연결됩니다.`,
    impact: "구조맵, 업무흐름, 지표, 인사이트 화면에서 같은 원천 데이터 관계를 조회합니다.",
    status: readiness >= 88 ? "반영 완료" : "보정 후 반영",
    evidenceIds: [ids.evidenceId],
    metricIds: [ids.metricId]
  };

  const metricDefinition: PrototypeState["metricDefinitions"][number] = {
    id: ids.metricId,
    name: `${dataName} 보정 완료율`,
    unit: "%",
    formula: "필수 메타데이터 입력값과 미리보기 필드 보유 여부를 합산",
    relatedObjectIds: [ids.entityId]
  };

  const metricValue: PrototypeState["metricValues"][number] = {
    id: ids.metricValueId,
    metricId: ids.metricId,
    value: readiness,
    previousValue: Math.max(0, readiness - 18),
    trend: "up",
    status: readiness >= 88 ? "normal" : "warning",
    chartType: "bar",
    series: [
      { label: "데이터명", value: 100 },
      { label: "설명", value: normalizedFile.description?.trim() ? 100 : 0 },
      { label: "유형", value: normalizedFile.kind ? 100 : 0 },
      { label: "담당 부서", value: owner === "미지정" ? 0 : 100 }
    ],
    calculatedAt: appliedAt,
    evidenceIds: [ids.evidenceId],
    basis: {
      fields: fields.length,
      rows: rowCount,
      source: normalizedFile.name
    }
  };

  const workflowMetricBinding: PrototypeState["workflowMetricBindings"][number] = {
    id: ids.workflowMetricBindingId,
    eventId: ids.applyEventId,
    metricId: ids.metricId,
    sourceManagedObjectIds: [ids.entityId]
  };

  const insight: PrototypeState["insights"][number] = {
    id: ids.insightId,
    title: `${dataName} 기준 반영 관계 생성`,
    status: "new",
    severity: readiness >= 88 ? "medium" : "low",
    detected: `${normalizedFile.name}의 데이터명, 설명, 유형, 담당 부서 기준이 현재 구조맵에 반영되었습니다.`,
    reason: "업로드 파일을 운영 기준 컬렉션에 연결해 관리 대상, 업무흐름, 지표, 인사이트가 같은 원천을 바라보도록 했습니다.",
    likelyCauses: [`담당 부서: ${owner}`, `데이터 유형: ${normalizedFile.kind}`, `주요 필드: ${fields.slice(0, 4).join(", ")}`],
    recommendedActions: ["구조 보기에서 추출 필드를 확인합니다.", "필요한 설명과 담당 부서를 보정합니다.", "현재 기준 반영 후 지표 연결을 검토합니다."],
    relatedMetricIds: [ids.metricId],
    relatedObjectIds: [ids.entityId],
    relatedEventIds: events.map((event) => event.id),
    relatedRelationIds: [ids.relationId],
    evidenceIds: [ids.evidenceId],
    supportSummary: [`${fields.length}개 필드와 ${rowCountLabel} 기준으로 반영했습니다.`]
  };

  return {
    ...cleared,
    activeInsightId: ids.insightId,
    company: { ...cleared.company, dataReadiness: "ready" },
    evidence: [evidence, ...cleared.evidence],
    entities: [entity, ...cleared.entities],
    events: [...events, ...cleared.events],
    insights: [insight, ...cleared.insights],
    managedObjectTypes: mergeDomainTypes("managed_object", cleared.managedObjectTypes, inferDomainTypes("managed_object", [normalizedFile.kind])),
    metricDefinitions: [metricDefinition, ...cleared.metricDefinitions],
    metricValues: [metricValue, ...cleared.metricValues],
    relations: [relation, ...cleared.relations],
    sourceFiles: cleared.sourceFiles.map((item) =>
      item.id === normalizedFile.id
        ? { ...normalizeSourceFile(item), description, status: "parsed" as const, uploadedAt, appliedAt }
        : normalizeSourceFile(item)
    ),
    structureMapView: normalizeStructureMapViewState({
      ...cleared.structureMapView,
      hiddenEdgeIds: [],
      hiddenNodeIds: [],
      searchQuery: "",
      selectedItemId: ids.entityId
    }),
    workflowMetricBindings: [workflowMetricBinding, ...cleared.workflowMetricBindings],
    workflowTypes: mergeDomainTypes("workflow", cleared.workflowTypes, inferDomainTypes("workflow", events.map((event) => event.workflowType)))
  };
}

function structureMapNodeExists(state: PrototypeState, nodeId: string): boolean {
  return (
    state.entities.some((entity) => entity.id === nodeId) ||
    state.events.some((event) => event.id === nodeId) ||
    state.metricDefinitions.some((metric) => metric.id === nodeId) ||
    state.insights.some((insight) => insight.id === nodeId)
  );
}

function updateStructureMapNode(state: PrototypeState, nodeId: string, patch: StructureMapNodePatch): PrototypeState {
  if (state.entities.some((entity) => entity.id === nodeId)) {
    return {
      ...state,
      entities: state.entities.map((entity) =>
        entity.id === nodeId
          ? {
              ...entity,
              kind: patch.kind ?? entity.kind,
              name: patch.name ?? entity.name,
              owner: patch.owner ?? entity.owner,
              status: patch.status ?? entity.status,
              summary: patch.summary ?? entity.summary
            }
          : entity
      ),
      permissionDenied: undefined
    };
  }

  if (state.events.some((event) => event.id === nodeId)) {
    return {
      ...state,
      events: state.events.map((event) =>
        event.id === nodeId
          ? {
              ...event,
              durationHours: typeof patch.durationHours === "number" ? patch.durationHours : event.durationHours,
              name: patch.name ?? event.name,
              occurredAt: patch.occurredAt ?? event.occurredAt,
              workflowType: patch.workflowType ?? event.workflowType
            }
          : event
      ),
      permissionDenied: undefined
    };
  }

  if (state.metricDefinitions.some((metric) => metric.id === nodeId)) {
    return {
      ...state,
      metricDefinitions: state.metricDefinitions.map((metric) =>
        metric.id === nodeId
          ? {
              ...metric,
              formula: patch.formula ?? metric.formula,
              name: patch.name ?? metric.name,
              relatedObjectIds: patch.relatedObjectIds ?? metric.relatedObjectIds,
              unit: patch.unit ?? metric.unit
            }
          : metric
      ),
      permissionDenied: undefined
    };
  }

  if (state.insights.some((insight) => insight.id === nodeId)) {
    return {
      ...state,
      insights: state.insights.map((insight) =>
        insight.id === nodeId
          ? {
              ...insight,
              reason: patch.reason ?? insight.reason,
              recommendedActions: patch.recommendedActions ?? insight.recommendedActions,
              severity: patch.severity ?? insight.severity,
              status: isInsightStatus(patch.status) ? patch.status : insight.status,
              title: patch.title ?? insight.title
            }
          : insight
      ),
      permissionDenied: undefined
    };
  }

  return { ...state, permissionDenied: "수정할 구조 맵 노드를 찾지 못했습니다." };
}

function updateStructureMapRelation(state: PrototypeState, relationId: string, patch: StructureMapRelationPatch): PrototypeState {
  const relation = state.relations.find((item) => item.id === relationId);
  if (!relation) {
    return { ...state, permissionDenied: "수정할 관계를 찾지 못했습니다." };
  }

  const fromId = patch.fromId ?? relation.fromId;
  const toId = patch.toId ?? relation.toId;
  if (!structureMapNodeExists(state, fromId) || !structureMapNodeExists(state, toId)) {
    return { ...state, permissionDenied: "관계의 시작 또는 끝 노드를 찾지 못했습니다." };
  }

  const type = patch.type === undefined ? relation.type : patch.type.trim();
  if (!type) {
    return { ...state, permissionDenied: "관계 유형을 입력해 주세요." };
  }

  return {
    ...state,
    relations: state.relations.map((item) =>
      item.id === relationId
        ? {
            ...item,
            confidence: patch.confidence ?? item.confidence,
            description: patch.description ?? item.description,
            fromId,
            impact: patch.impact ?? item.impact,
            metricIds: patch.metricIds ?? item.metricIds,
            relationKind: patch.relationKind ?? item.relationKind,
            status: patch.status ?? item.status,
            strength: patch.strength ?? item.strength,
            toId,
            type
          }
        : item
    ),
    permissionDenied: undefined
  };
}

function addStructureMapRelation(state: PrototypeState, relation: StructureMapRelationInput, action: ActionMeta): PrototypeState {
  if (!structureMapNodeExists(state, relation.fromId) || !structureMapNodeExists(state, relation.toId)) {
    return { ...state, permissionDenied: "관계의 시작 또는 끝 노드를 찾지 못했습니다." };
  }

  const normalizedType = relation.type.trim();
  if (!normalizedType) {
    return { ...state, permissionDenied: "관계 유형을 입력해 주세요." };
  }

  const id = uniqueStructureRelationId(state, relation.id, normalizedType, action);
  return {
    ...state,
    relations: [
      {
        ...relation,
        id,
        type: normalizedType,
        evidenceIds: relation.evidenceIds ?? []
      },
      ...state.relations
    ],
    permissionDenied: undefined
  };
}

function deleteStructureMapRelation(state: PrototypeState, relationId: string): PrototypeState {
  if (!state.relations.some((relation) => relation.id === relationId)) {
    return { ...state, permissionDenied: "삭제할 관계를 찾지 못했습니다." };
  }

  return {
    ...state,
    entities: state.entities.map((entity) => ({ ...entity, relationIds: entity.relationIds.filter((id) => id !== relationId) })),
    insights: state.insights.map((insight) => ({ ...insight, relatedRelationIds: insight.relatedRelationIds.filter((id) => id !== relationId) })),
    relations: state.relations.filter((relation) => relation.id !== relationId),
    structureMapView: normalizeStructureMapViewState({
      ...state.structureMapView,
      hiddenEdgeIds: state.structureMapView.hiddenEdgeIds.filter((id) => id !== `edge-${relationId}`),
      selectedItemId: state.structureMapView.selectedItemId === `edge-${relationId}` ? undefined : state.structureMapView.selectedItemId
    }),
    permissionDenied: undefined
  };
}

function withStructureMapHiddenItem(state: PrototypeState, itemId: string, kind: "node" | "edge", hidden: boolean): PrototypeState {
  const key = kind === "node" ? "hiddenNodeIds" : "hiddenEdgeIds";
  const currentIds = state.structureMapView[key];
  const nextIds = hidden ? Array.from(new Set([...currentIds, itemId])) : currentIds.filter((id) => id !== itemId);
  return {
    ...state,
    structureMapView: normalizeStructureMapViewState({
      ...state.structureMapView,
      [key]: nextIds,
      selectedItemId: hidden && state.structureMapView.selectedItemId === itemId ? undefined : state.structureMapView.selectedItemId
    }),
    permissionDenied: undefined
  };
}

function uniqueStructureRelationId(state: PrototypeState, requestedId: string | undefined, relationType: string, action: ActionMeta): string {
  if (requestedId && !state.relations.some((relation) => relation.id === requestedId)) {
    return requestedId;
  }

  const stem = relationType.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "") || "relation";
  const timestamp = at(action).replace(/[^0-9]/g, "").slice(0, 14) || "manual";
  let id = `relation-structure-${stem}-${timestamp}`;
  let index = 2;
  while (state.relations.some((relation) => relation.id === id)) {
    id = `relation-structure-${stem}-${timestamp}-${index}`;
    index += 1;
  }
  return id;
}

function isInsightStatus(value: string | undefined): value is PrototypeState["insights"][number]["status"] {
  return value === "new" || value === "reviewing" || value === "proposal_created" || value === "paused" || value === "resolved";
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
        structureMapView: normalizeStructureMapViewState(action.state.structureMapView),
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

    case "UPDATE_SOURCE_FILE": {
      const cleared = removeSourceFileOperationalData(state, sourceFileOperationalIds(action.fileId));
      return withAudit(
        {
          ...cleared,
          sourceFiles: cleared.sourceFiles.map((file) =>
            file.id === action.fileId
              ? {
                  ...normalizeSourceFile(file),
                  ...action.patch,
                  description: action.patch.description?.trim() || file.description,
                  organizationCategoryId: normalizeCategoryId(state, action.patch.organizationCategoryId ?? file.organizationCategoryId),
                  status: "ready" as const,
                  appliedAt: undefined
                }
              : normalizeSourceFile(file)
          ),
          notifications: [
            { id: action.notificationId ?? "notice-source-file-update", level: "success", message: "파일 정보가 수정되었습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "APPLY_SOURCE_FILE_TO_CURRENT_STANDARD": {
      const sourceFile = state.sourceFiles.find((file) => file.id === action.fileId);
      if (!sourceFile) {
        return { ...state, permissionDenied: "반영할 파일을 찾지 못했습니다." };
      }

      return withAudit(
        {
          ...applySourceFileOperationalData(state, sourceFile, at(action)),
          screen: "vault",
          permissionDenied: undefined,
          notifications: [
            { id: action.notificationId ?? "notice-source-file-apply", level: "success", message: "원천 데이터 관계를 현재 기준에 반영했습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "REMOVE_SOURCE_FILE": {
      const cleared = removeSourceFileOperationalData(state, sourceFileOperationalIds(action.fileId));
      return withAudit(
        {
          ...cleared,
          sourceFiles: cleared.sourceFiles
            .filter((file) => file.id !== action.fileId)
            .map((file) => normalizeSourceFile(file)),
          notifications: [
            { id: action.notificationId ?? "notice-source-file-remove", level: "info", message: "파일이 데이터 보관함에서 제거되었습니다." },
            ...state.notifications
          ]
        },
        action
      );
    }

    case "SET_STRUCTURE_MAP_VIEW":
      return {
        ...state,
        structureMapView: normalizeStructureMapViewState({
          ...state.structureMapView,
          ...action.patch
        }),
        permissionDenied: undefined
      };

    case "UPDATE_STRUCTURE_MAP_NODE":
      return withAudit(updateStructureMapNode(state, action.nodeId, action.patch), action);

    case "UPDATE_STRUCTURE_MAP_RELATION":
      return withAudit(updateStructureMapRelation(state, action.relationId, action.patch), action);

    case "ADD_STRUCTURE_MAP_RELATION":
      return withAudit(addStructureMapRelation(state, action.relation, action), action);

    case "DELETE_STRUCTURE_MAP_RELATION":
      return withAudit(deleteStructureMapRelation(state, action.relationId), action);

    case "HIDE_STRUCTURE_MAP_ITEM":
      return withStructureMapHiddenItem(state, action.itemId, action.kind, true);

    case "UNHIDE_STRUCTURE_MAP_ITEM":
      return withStructureMapHiddenItem(state, action.itemId, action.kind, false);

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
          screen: "vault",
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
          screen: "vault",
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

      return nextStep.status === "reviewing_ready" ? { ...next, screen: "vault" } : next;
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
