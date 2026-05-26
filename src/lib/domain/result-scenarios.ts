import type {
  AIInsight,
  CandidateType,
  EntityInstance,
  EventRecord,
  ExtractionCandidate,
  MetricChartType,
  MetricDefinition,
  MetricValue,
  Proposal,
  Relation,
  SelectionProfile,
  SelectionScope,
  WorkflowMetricBinding,
  WorkspaceResultBundle
} from "./types";
import {
  sampleMetricCandidateIdsByWorkflowCandidate,
  sampleRelatedCandidateIdsByManagedObject,
  sampleResultScenarios,
  type SampleResultScenario,
  type ResultScenarioId
} from "./sample-analysis";

export type { ResultScenarioId } from "./sample-analysis";
export type DashboardChartType = MetricChartType;

type OperationalSelection = {
  candidates: ExtractionCandidate[];
  selectedCandidateIds: Set<string>;
  entityIds: Set<string>;
  eventIds: Set<string>;
  relationIds: Set<string>;
  metricIds: Set<string>;
  entities: EntityInstance[];
  events: EventRecord[];
  relations: Relation[];
  metricDefinitions: MetricDefinition[];
  metricValues: MetricValue[];
  workflowMetricBindings: WorkflowMetricBinding[];
};

export type ProposalDraft = Pick<
  Proposal,
  "id" | "insightId" | "title" | "status" | "summary" | "expectedImpact" | "votingRule" | "voterUserIds" | "deadline" | "createdAt" | "comments"
>;

type ScenarioDefinition = SampleResultScenario;

type DownstreamCandidateType = "workflow_event" | "relation" | "metric";

const downstreamCandidateTypes: DownstreamCandidateType[] = ["workflow_event", "relation", "metric"];

export const relatedCandidateIdsByManagedObject = sampleRelatedCandidateIdsByManagedObject;

export const metricCandidateIdsByWorkflowCandidate = sampleMetricCandidateIdsByWorkflowCandidate;

export function workflowsHaveSelectedMetrics(workflowCandidateIds: string[], metricCandidateIds: string[]): boolean {
  const selectedMetricIds = new Set(metricCandidateIds);

  return workflowCandidateIds.every((workflowCandidateId) =>
    (metricCandidateIdsByWorkflowCandidate[workflowCandidateId] ?? []).some((metricCandidateId) => selectedMetricIds.has(metricCandidateId))
  );
}

export const resultScenarios: ScenarioDefinition[] = sampleResultScenarios;

export function scenariosForSelection(selectedManagedCandidateIds: string[]): ScenarioDefinition[] {
  return selectedManagedCandidateIds
    .map((candidateId) => resultScenarios.find((scenario) => scenario.managedCandidateId === candidateId))
    .filter((scenario): scenario is ScenarioDefinition => Boolean(scenario));
}

export function chartTypeForInsight(insightId?: string): DashboardChartType {
  return resultScenarios.find((scenario) => scenario.insightId === insightId)?.dashboard.chartType ?? "table";
}

export function chartTitleForInsight(insightId?: string): string {
  return resultScenarios.find((scenario) => scenario.insightId === insightId)?.dashboard.chartTitle ?? "운영 지표 요약";
}

export function chartDescriptionForInsight(insightId?: string): string {
  return resultScenarios.find((scenario) => scenario.insightId === insightId)?.dashboard.chartDescription ?? "선택된 관리 대상과 연결된 지표를 표 형식으로 요약합니다.";
}

export function proposalIdForInsight(insightId: string): string {
  const scenario = resultScenarios.find((item) => item.insightId === insightId);
  if (scenario) {
    return scenario.proposal.id;
  }

  return `proposal-${insightId.replace(/^insight-/, "").replace(/[^a-z0-9가-힣-]+/gi, "-") || "generated"}`;
}

export function decisionIdForProposal(proposalId: string): string {
  return `decision-${proposalId.replace(/^proposal-/, "").replace(/[^a-z0-9가-힣-]+/gi, "-") || "generated"}`;
}

export function buildSelectionScope({
  candidates,
  manuallyExcludedCandidateIds,
  selectedCandidateIds
}: {
  candidates: ExtractionCandidate[];
  manuallyExcludedCandidateIds?: string[];
  selectedCandidateIds: Set<string>;
}): SelectionScope {
  const selectedManagedCandidateIds = idsInCandidateOrder(candidates, "managed_object").filter((candidateId) =>
    selectedCandidateIds.has(candidateId)
  );
  const autoIncludedByType: Record<DownstreamCandidateType, Set<string>> = {
    workflow_event: new Set(),
    relation: new Set(),
    metric: new Set()
  };
  const candidateProvenance: Record<string, string[]> = {};

  selectedManagedCandidateIds.forEach((managedCandidateId) => {
    downstreamCandidateTypes.forEach((candidateType) => {
      const downstreamIds = relatedCandidateIdsByManagedObject[managedCandidateId]?.[candidateType] ?? [];
      downstreamIds.forEach((candidateId) => {
        autoIncludedByType[candidateType].add(candidateId);
        candidateProvenance[candidateId] = Array.from(new Set([...(candidateProvenance[candidateId] ?? []), managedCandidateId]));
      });
    });
  });

  const derivedManualExclusions = candidates
    .filter((candidate) => isDownstreamCandidateType(candidate.type) && !selectedCandidateIds.has(candidate.id))
    .filter((candidate) => autoIncludedByType[candidate.type as "workflow_event" | "relation" | "metric"].has(candidate.id))
    .map((candidate) => candidate.id);
  const manualExclusions = new Set(manuallyExcludedCandidateIds ?? derivedManualExclusions);
  const includedByType = (candidateType: DownstreamCandidateType) =>
    idsInCandidateOrder(candidates, candidateType).filter((candidateId) => {
      const directlySelected = selectedCandidateIds.has(candidateId);
      const autoIncluded = autoIncludedByType[candidateType].has(candidateId);
      return (directlySelected || autoIncluded) && !manualExclusions.has(candidateId);
    });

  return {
    selectedManagedCandidateIds,
    includedWorkflowCandidateIds: includedByType("workflow_event"),
    includedRelationCandidateIds: includedByType("relation"),
    includedMetricCandidateIds: includedByType("metric"),
    manuallyExcludedCandidateIds: idsInCandidateOrder(candidates).filter((candidateId) => manualExclusions.has(candidateId)),
    candidateProvenance
  };
}

export function buildSelectionProfile({
  candidates,
  scenarioIds,
  scope
}: {
  candidates: ExtractionCandidate[];
  scenarioIds: ResultScenarioId[];
  scope: SelectionScope;
}): SelectionProfile {
  const selectedCandidateIds = idsInCandidateOrder(candidates).filter(
    (candidateId) =>
      scope.selectedManagedCandidateIds.includes(candidateId) ||
      scope.includedWorkflowCandidateIds.includes(candidateId) ||
      scope.includedRelationCandidateIds.includes(candidateId) ||
      scope.includedMetricCandidateIds.includes(candidateId)
  );

  return {
    selectedCandidateIds,
    excludedCandidateIds: candidates.filter((candidate) => !selectedCandidateIds.includes(candidate.id)).map((candidate) => candidate.id),
    selectedManagedCandidateIds: scope.selectedManagedCandidateIds,
    primaryManagedCandidateId: scope.selectedManagedCandidateIds[0],
    managedCandidateId: scope.selectedManagedCandidateIds[0],
    workflowCandidateIds: scope.includedWorkflowCandidateIds,
    relationCandidateIds: scope.includedRelationCandidateIds,
    metricCandidateIds: scope.includedMetricCandidateIds,
    scenarioIds,
    scenarioId: scenarioIds[0]
  };
}

export function buildWorkspaceResultBundle(selection: OperationalSelection): WorkspaceResultBundle {
  const scope = buildSelectionScope({
    candidates: selection.candidates,
    selectedCandidateIds: selection.selectedCandidateIds
  });
  const scenarios = scenariosForSelection(scope.selectedManagedCandidateIds);
  const profile = buildSelectionProfile({
    candidates: selection.candidates,
    scenarioIds: scenarios.map((scenario) => scenario.id),
    scope
  });
  const insights = buildInsights(selection, scenarios);
  const insightIdsByEntity = new Map<string, string[]>();
  insights.forEach((insight) => {
    insight.relatedObjectIds.forEach((objectId) => {
      insightIdsByEntity.set(objectId, [...(insightIdsByEntity.get(objectId) ?? []), insight.id]);
    });
  });

  return {
    selection: profile,
    scope,
    entities: selection.entities.map((entity) => {
      const eventIds = selection.events
        .filter((event) => event.objectId === entity.id || entity.eventIds.includes(event.id))
        .map((event) => event.id);
      const metricIds = selection.metricDefinitions
        .filter((metric) => metric.relatedObjectIds.includes(entity.id) || entity.metricIds.includes(metric.id))
        .map((metric) => metric.id);
      const relationIds = selection.relations
        .filter((relation) => relation.fromId === entity.id || relation.toId === entity.id || entity.relationIds.includes(relation.id))
        .map((relation) => relation.id);

      return {
        ...entity,
        decisionIds: [],
        eventIds,
        insightIds: insightIdsByEntity.get(entity.id) ?? [],
        metricIds,
        relationIds
      };
    }),
    events: selection.events,
    relations: selection.relations,
    metricDefinitions: selection.metricDefinitions,
    metricValues: selection.metricValues,
    workflowMetricBindings: selection.workflowMetricBindings,
    insights,
    proposals: [],
    decisions: [],
    verificationRecords: []
  };
}

export function buildProposalDraftFromInsight({
  authorId,
  createdAt,
  voterUserIds,
  insight
}: {
  authorId: string;
  createdAt: string;
  voterUserIds: string[];
  insight: AIInsight;
}): ProposalDraft {
  const scenario = resultScenarios.find((item) => item.insightId === insight.id);
  const deadline = new Date(Date.parse(createdAt) + 24 * 60 * 60 * 1000).toISOString();

  return {
    id: scenario?.proposal.id ?? proposalIdForInsight(insight.id),
    insightId: insight.id,
    title: scenario?.proposal.title ?? `${insight.title} 대응 안건`,
    status: "voting",
    summary: scenario?.proposal.summary ?? `${insight.title}에 대한 조치 범위와 실행 기준을 투표로 확정합니다.`,
    expectedImpact: scenario?.proposal.expectedImpact ?? "관련 지표의 위험도를 낮추고 다음 재분석 주기에서 개선 여부를 확인합니다.",
    votingRule: {
      quorumPercent: 50,
      approvalPercent: 60,
      allowAbstain: true,
      allowVoteChange: true,
      tieBreakerRole: "owner"
    },
    voterUserIds,
    deadline,
    createdAt,
    comments: [
      {
        id: `comment-${scenario?.id ?? "generated"}-${authorId}`,
        authorId,
        message: scenario?.proposal.comment ?? "선택된 지표와 연결 관계를 기준으로 안건 초안을 검토합니다.",
        createdAt
      }
    ]
  };
}

function buildInsights(selection: OperationalSelection, scenarios: ScenarioDefinition[]): AIInsight[] {
  const scenarioInsights = scenarios
    .map((scenario) => buildScenarioInsight(selection, scenario))
    .filter(hasOperationalSignal);

  if (scenarioInsights.length > 0) {
    return scenarioInsights;
  }

  if (selection.entities.length === 0 && selection.events.length === 0 && selection.metricDefinitions.length === 0 && selection.relations.length === 0) {
    return [];
  }

  return [buildFallbackInsight(selection)];
}

function buildScenarioInsight(selection: OperationalSelection, scenario: ScenarioDefinition): AIInsight {
  return {
    id: scenario.insightId,
    title: scenario.title,
    status: "new",
    severity: scenario.severity,
    detected: scenario.detected,
    reason: scenario.reason,
    likelyCauses: scenario.likelyCauses,
    recommendedActions: scenario.recommendedActions,
    supportSummary: scenario.supportSummary,
    relatedMetricIds: scenario.relatedMetricIds.filter((id) => selection.metricIds.has(id)),
    relatedObjectIds: scenario.relatedObjectIds.filter((id) => selection.entityIds.has(id)),
    relatedEventIds: scenario.relatedEventIds.filter((id) => selection.eventIds.has(id)),
    relatedRelationIds: scenario.relatedRelationIds.filter((id) => selection.relationIds.has(id)),
    evidenceIds: scenario.evidenceIds
  };
}

function buildFallbackInsight(selection: OperationalSelection): AIInsight {
  const objectName = selection.entities[0]?.name ?? "선택된 관리 대상";
  const metricNames = selection.metricDefinitions.map((metric) => metric.name).join(", ") || "선택 지표";

  return {
    id: `insight-${selection.entities[0]?.id ?? "selected"}-signals`,
    title: `${objectName} 운영 신호 점검`,
    status: "new",
    severity: selection.metricValues.some((value) => value.status === "critical") ? "high" : "medium",
    detected: `${objectName}과 연결된 ${metricNames} 기준으로 추가 검토가 필요한 신호가 감지되었습니다.`,
    reason: "선택된 후보 조합이 기본 대표 시나리오와 완전히 일치하지 않아 남아 있는 연결 항목을 기준으로 운영 신호를 구성했습니다.",
    likelyCauses: selection.relations.length > 0 ? selection.relations.map((relation) => relation.description) : ["선택된 업무 흐름의 상태 변화"],
    recommendedActions: ["선택한 지표의 계산 기준을 확인합니다.", "연결된 업무 흐름과 근거 파일을 함께 검토합니다.", "다음 재분석 주기에서 같은 조합을 다시 비교합니다."],
    supportSummary: [
      `${selection.metricDefinitions.length}개 지표와 ${selection.relations.length}개 연결 edge를 기준으로 조합했습니다.`,
      "대표 시나리오가 아닐 때도 선택된 후보의 근거 행과 관계를 유지합니다."
    ],
    relatedMetricIds: selection.metricDefinitions.map((metric) => metric.id),
    relatedObjectIds: selection.entities.map((entity) => entity.id),
    relatedEventIds: selection.events.map((event) => event.id),
    relatedRelationIds: selection.relations.map((relation) => relation.id),
    evidenceIds: Array.from(new Set([
      ...selection.events.flatMap((event) => event.evidenceIds),
      ...selection.relations.flatMap((relation) => relation.evidenceIds),
      ...selection.metricValues.flatMap((value) => value.evidenceIds)
    ]))
  };
}

function hasOperationalSignal(insight: AIInsight): boolean {
  return (
    insight.relatedMetricIds.length > 0 ||
    insight.relatedObjectIds.length > 0 ||
    insight.relatedEventIds.length > 0 ||
    insight.relatedRelationIds.length > 0
  );
}

function idsInCandidateOrder(candidates: ExtractionCandidate[], candidateType?: CandidateType): string[] {
  return candidates
    .filter((candidate) => !candidateType || candidate.type === candidateType)
    .map((candidate) => candidate.id);
}

function isDownstreamCandidateType(candidateType: CandidateType): candidateType is DownstreamCandidateType {
  return downstreamCandidateTypes.includes(candidateType as DownstreamCandidateType);
}
