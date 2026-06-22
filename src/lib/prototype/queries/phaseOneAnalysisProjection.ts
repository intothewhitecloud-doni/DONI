import {
  sampleResultScenarios,
  type SampleResultScenario
} from "../../domain/sample-analysis";
import type {
  AIInsight,
  EntityInstance,
  EventRecord,
  EvidenceReference,
  LinkTarget,
  MetricDefinition,
  MetricValue,
  PrototypeState,
  Relation,
  SourceFile
} from "../../domain/types";
import { currentCompanyData } from "../selectors";

export type PhaseOneApplyStatus = "pending" | "analyzing" | "applied";
export type PhaseOneTone = "neutral" | "info" | "warning" | "danger" | "success";
export type PhaseOneStructureKind = "entity" | "event" | "relation" | "metric" | "decision";

export type PhaseOneStructureItem = {
  id: string;
  title: string;
  description: string;
  tone: PhaseOneTone;
  evidenceIds?: string[];
  sourceFileIds?: string[];
  target?: LinkTarget;
  targetId?: string;
};

export type PhaseOneStructureGroup = {
  kind: PhaseOneStructureKind;
  label: string;
  items: PhaseOneStructureItem[];
};

export type PhaseOneDecisionCandidate = {
  id: string;
  title: string;
  statusLabel: string;
  impactLabel: string;
  evidenceStrengthLabel: string;
  summary: string;
  expectedImpact: string;
  risks: string[];
  preDecisionChecks: string[];
  relatedMetricIds: string[];
  relatedObjectIds: string[];
  relatedEventIds: string[];
  relatedRelationIds: string[];
  evidenceIds: string[];
  sourceFileIds: string[];
  proposalTitle: string;
  target: LinkTarget;
};

export type PhaseOneSignal = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: PhaseOneTone;
  target?: LinkTarget;
};

export type PhaseOneFileProjection = {
  sourceFileId: string;
  fileName: string;
  applyStatus: PhaseOneApplyStatus;
  applyStatusLabel: string;
  aiStatusLabel: string;
  impactSummary: string;
  majorFields: string[];
  affectedScreens: PhaseOneSignal[];
  structureGroups: PhaseOneStructureGroup[];
  decisionCandidateIds: string[];
  evidenceIds: string[];
  flowSteps: PhaseOneSignal[];
};

export type PhaseOneAnalysisProjection = {
  generatedAtLabel: string;
  summary: PhaseOneSignal[];
  primarySignals: PhaseOneSignal[];
  structureGroups: PhaseOneStructureGroup[];
  decisionCandidates: PhaseOneDecisionCandidate[];
  files: PhaseOneFileProjection[];
};

type ProjectionData = ReturnType<typeof currentCompanyData>;

const groupLabels: Record<PhaseOneStructureKind, string> = {
  decision: "Decision 후보",
  entity: "Entity",
  event: "Event",
  metric: "Metric",
  relation: "Relation"
};

const preferredEntityIds = [
  "entity-low-margin",
  "entity-supplier-a",
  "entity-customer-core",
  "entity-product-control",
  "entity-product-precision",
  "entity-supplier-b"
];
const preferredEventIds = ["event-order", "event-outbound", "event-delivery", "event-claim", "event-compensation"];
const preferredRelationIds = [
  "relation-supplier-product",
  "relation-customer-claim",
  "relation-supplier-b-product",
  "relation-supplier-a-precision"
];
const preferredMetricIds = ["metric-margin", "metric-delay-time", "metric-claim-rate"];

export function getPhaseOneAnalysisProjection(state: PrototypeState): PhaseOneAnalysisProjection {
  const data = currentCompanyData(state);
  const evidenceById = new Map(data.evidence.map((evidence) => [evidence.id, evidence]));
  const metricValueByMetricId = new Map(data.metricValues.map((value) => [value.metricId, value]));
  const decisionCandidates = buildDecisionCandidates(data, evidenceById);
  const structureGroups = buildStructureGroups(data, metricValueByMetricId, decisionCandidates, evidenceById);
  const primarySignals = buildPrimarySignals(data);
  const files = data.sourceFiles.map((file) =>
    buildFileProjection(file, structureGroups, decisionCandidates, data.evidence, primarySignals)
  );

  return {
    generatedAtLabel: "Phase 1 mock projection",
    summary: buildSummarySignals(structureGroups, decisionCandidates),
    primarySignals,
    structureGroups,
    decisionCandidates,
    files
  };
}

export function findPhaseOneFileProjection(
  projection: PhaseOneAnalysisProjection,
  sourceFileId?: string
): PhaseOneFileProjection | undefined {
  if (!sourceFileId) {
    return undefined;
  }

  return projection.files.find((file) => file.sourceFileId === sourceFileId);
}

function buildStructureGroups(
  data: ProjectionData,
  metricValueByMetricId: Map<string, MetricValue>,
  decisionCandidates: PhaseOneDecisionCandidate[],
  evidenceById: Map<string, EvidenceReference>
): PhaseOneStructureGroup[] {
  return [
    {
      kind: "entity",
      label: groupLabels.entity,
      items: orderByPreferred(data.entities, preferredEntityIds).map((entity) => entityToStructureItem(entity, evidenceById))
    },
    {
      kind: "event",
      label: groupLabels.event,
      items: orderByPreferred(data.events, preferredEventIds).map((event) => eventToStructureItem(event, evidenceById))
    },
    {
      kind: "relation",
      label: groupLabels.relation,
      items: orderByPreferred(data.relations, preferredRelationIds).map((relation) => relationToStructureItem(relation, data, evidenceById))
    },
    {
      kind: "metric",
      label: groupLabels.metric,
      items: orderByPreferred(data.metricDefinitions, preferredMetricIds).map((metric) =>
        metricToStructureItem(metric, metricValueByMetricId.get(metric.id), evidenceById)
      )
    },
    {
      kind: "decision",
      label: groupLabels.decision,
      items: decisionCandidates.map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        description: candidate.summary,
        evidenceIds: candidate.evidenceIds,
        sourceFileIds: candidate.sourceFileIds,
        target: candidate.target,
        targetId: candidate.id,
        tone: candidate.impactLabel === "높은 영향" ? "danger" : "warning"
      }))
    }
  ];
}

function buildDecisionCandidates(
  data: ProjectionData,
  evidenceById: Map<string, EvidenceReference>
): PhaseOneDecisionCandidate[] {
  const insightById = new Map(data.insights.map((insight) => [insight.id, insight]));

  return sampleResultScenarios.map((scenario) => {
    const insight = insightById.get(scenario.insightId);
    const evidenceIds = insight?.evidenceIds ?? scenario.evidenceIds;
    const title = normalizeManagerFacingCopy(scenario.proposal.title);

    return {
      id: scenario.insightId,
      title,
      statusLabel: statusLabelForInsight(insight),
      impactLabel: scenario.severity === "high" ? "높은 영향" : "검토 필요",
      evidenceStrengthLabel: evidenceStrengthLabel(evidenceIds, evidenceById),
      summary: normalizeManagerFacingCopy(scenario.proposal.summary || insight?.reason || scenario.reason),
      expectedImpact: normalizeManagerFacingCopy(scenario.proposal.expectedImpact),
      risks: scenario.likelyCauses.map(normalizeManagerFacingCopy),
      preDecisionChecks: preDecisionChecksForScenario(scenario),
      relatedMetricIds: insight?.relatedMetricIds ?? scenario.relatedMetricIds,
      relatedObjectIds: insight?.relatedObjectIds ?? scenario.relatedObjectIds,
      relatedEventIds: insight?.relatedEventIds ?? scenario.relatedEventIds,
      relatedRelationIds: insight?.relatedRelationIds ?? scenario.relatedRelationIds,
      evidenceIds,
      sourceFileIds: unique(evidenceIds.map((id) => evidenceById.get(id)?.sourceFileId).filter(Boolean)),
      proposalTitle: title,
      target: { screen: "insightDetail", focusId: scenario.insightId, label: `${title} 검토` }
    };
  });
}

function buildPrimarySignals(data: ProjectionData): PhaseOneSignal[] {
  const ordersFile = findSourceFile(data.sourceFiles, "주문_배송_클레임.xlsx", "주문");
  const marginFile = findSourceFile(data.sourceFiles, "상품별_마진_공급사.csv", "마진");
  const p42OrderRows = parseRows(ordersFile).filter((row) => row["상품군"] === "P-42");
  const p42MarginRows = parseRows(marginFile).filter((row) => row["상품군"] === "P-42");
  const delayedP42Rows = p42OrderRows.filter((row) => String(row["주문상태"] ?? row["배송상태"] ?? "").includes("지연"));
  const claimedP42Rows = p42OrderRows.filter((row) => hasClaim(row));
  const revenue = sum(p42MarginRows.map((row) => parseNumber(row["매출"])));
  const marginRate = average(p42MarginRows.map((row) => parsePercent(row["평균마진율"])));
  const complianceRate = average(p42MarginRows.map((row) => parsePercent(row["납품준수율"])));
  const waitHours = average(p42OrderRows.map((row) => parseNumber(row["출고대기시간"])));

  return [
    {
      id: "p42-revenue",
      label: "P-42 매출",
      value: revenue > 0 ? formatRevenue(revenue) : "260M",
      detail: "상품별_마진_공급사.csv P-42 2행 합계",
      tone: "info",
      target: { screen: "metrics", focusId: "metric-margin", label: "P-42 마진 보기" }
    },
    {
      id: "p42-margin",
      label: "평균마진율",
      value: formatPercentLabel(marginRate, "13.6%"),
      detail: "P-42 표본 평균, 비교군 대비 낮음",
      tone: "danger",
      target: { screen: "metrics", focusId: "metric-margin", label: "평균 마진율 보기" }
    },
    {
      id: "supplier-a-compliance",
      label: "A사 납품준수",
      value: formatPercentLabel(complianceRate, "71%"),
      detail: "P-42 납품준수율 70~72%",
      tone: "warning",
      target: { screen: "objects", focusId: "entity-supplier-a", label: "공급업체 A사 보기" }
    },
    {
      id: "p42-delay-rate",
      label: "P-42 지연률",
      value: formatPercentLabel(rate(delayedP42Rows.length, p42OrderRows.length), "80%"),
      detail: `${delayedP42Rows.length || 4}/${p42OrderRows.length || 5}건 출고 지연`,
      tone: "danger",
      target: { screen: "workflow", focusId: "event-outbound", label: "출고 지연 보기" }
    },
    {
      id: "p42-claim-rate",
      label: "P-42 클레임률",
      value: formatPercentLabel(rate(claimedP42Rows.length, p42OrderRows.length), "100%"),
      detail: `${claimedP42Rows.length || 5}/${p42OrderRows.length || 5}건 클레임/문의 기록`,
      tone: "danger",
      target: { screen: "metrics", focusId: "metric-claim-rate", label: "클레임률 보기" }
    },
    {
      id: "p42-wait-hours",
      label: "평균 출고 대기",
      value: waitHours === undefined ? "36.8시간" : `${formatOne(waitHours)}시간`,
      detail: "주문_배송_클레임.xlsx P-42 기준",
      tone: "warning",
      target: { screen: "metrics", focusId: "metric-delay-time", label: "주문 처리 시간 보기" }
    }
  ];
}

function buildSummarySignals(
  groups: PhaseOneStructureGroup[],
  decisionCandidates: PhaseOneDecisionCandidate[]
): PhaseOneSignal[] {
  return groups.map((group) => ({
    id: `summary-${group.kind}`,
    label: group.label,
    value: `${group.kind === "decision" ? decisionCandidates.length : group.items.length}개`,
    detail: summaryDetailForKind(group.kind),
    tone: group.kind === "decision" ? "warning" : group.items.some((item) => item.tone === "danger") ? "danger" : "info"
  }));
}

function buildFileProjection(
  file: SourceFile,
  groups: PhaseOneStructureGroup[],
  decisionCandidates: PhaseOneDecisionCandidate[],
  evidence: EvidenceReference[],
  primarySignals: PhaseOneSignal[]
): PhaseOneFileProjection {
  const evidenceIds = evidence.filter((item) => item.sourceFileId === file.id).map((item) => item.id);
  const filteredGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.sourceFileIds?.includes(file.id) || item.evidenceIds?.some((id) => evidenceIds.includes(id)))
  }));
  const decisionCandidateIds = decisionCandidates
    .filter((candidate) => candidate.sourceFileIds.includes(file.id) || candidate.evidenceIds.some((id) => evidenceIds.includes(id)))
    .map((candidate) => candidate.id);
  const isOrders = file.id === "source-orders" || file.name.includes("주문");
  const isMargin = file.id === "source-margin" || file.name.includes("마진");

  return {
    sourceFileId: file.id,
    fileName: file.name,
    applyStatus: file.appliedAt ? "applied" : file.status === "parsed" ? "analyzing" : "pending",
    applyStatusLabel: file.appliedAt ? "반영 완료" : file.status === "parsed" ? "분석 중" : "반영 대기",
    aiStatusLabel: file.appliedAt ? "AI 분석 반영됨" : file.status === "parsed" ? "AI 구조화 진행 중" : "AI 분석 전 검수",
    impactSummary: impactSummaryForFile(file, filteredGroups, decisionCandidateIds),
    majorFields: file.previewColumns?.slice(0, 8) ?? [],
    affectedScreens: affectedScreensForFile(isOrders, isMargin),
    structureGroups: filteredGroups,
    decisionCandidateIds,
    evidenceIds,
    flowSteps: flowStepsForFile(file, isOrders, isMargin, primarySignals)
  };
}

function entityToStructureItem(entity: EntityInstance, evidenceById: Map<string, EvidenceReference>): PhaseOneStructureItem {
  const title = entity.id === "entity-customer-core" ? "핵심 고객군" : entity.name;

  return {
    id: entity.id,
    title,
    description: normalizeManagerFacingCopy(entity.summary),
    evidenceIds: evidenceIdsFromEntity(entity, evidenceById),
    sourceFileIds: sourceFileIdsFromEvidence(evidenceIdsFromEntity(entity, evidenceById), evidenceById),
    target: { screen: "objects", focusId: entity.id, label: `${title} 보기` },
    targetId: entity.id,
    tone: entity.status.includes("개선") || entity.status.includes("점검") || entity.status.includes("주의") ? "warning" : "info"
  };
}

function eventToStructureItem(event: EventRecord, evidenceById: Map<string, EvidenceReference>): PhaseOneStructureItem {
  return {
    id: event.id,
    title: event.name,
    description: `${event.workflowType} 흐름 · ${formatOne(event.durationHours)}시간`,
    evidenceIds: event.evidenceIds,
    sourceFileIds: sourceFileIdsFromEvidence(event.evidenceIds, evidenceById),
    target: { screen: "workflow", focusId: event.id, label: `${event.name} 보기` },
    targetId: event.id,
    tone: event.workflowType === "증가" || event.workflowType === "지연" ? "danger" : "info"
  };
}

function relationToStructureItem(
  relation: Relation,
  data: ProjectionData,
  evidenceById: Map<string, EvidenceReference>
): PhaseOneStructureItem {
  const from = entityOrEventName(relation.fromId, data);
  const to = entityOrEventName(relation.toId, data);

  return {
    id: relation.id,
    title: `${from} -> ${to}`,
    description: relation.description,
    evidenceIds: relation.evidenceIds,
    sourceFileIds: sourceFileIdsFromEvidence(relation.evidenceIds, evidenceById),
    target: { screen: "objects", focusId: relation.fromId, label: `${from} 연결 보기` },
    targetId: relation.id,
    tone: relation.strength === "strong" ? "warning" : "info"
  };
}

function metricToStructureItem(
  metric: MetricDefinition,
  value: MetricValue | undefined,
  evidenceById: Map<string, EvidenceReference>
): PhaseOneStructureItem {
  const currentValue = value ? `${formatOne(value.value)}${metric.unit}` : metric.unit;

  return {
    id: metric.id,
    title: metric.name,
    description: `${currentValue} · ${metric.formula}`,
    evidenceIds: value?.evidenceIds ?? [],
    sourceFileIds: sourceFileIdsFromEvidence(value?.evidenceIds ?? [], evidenceById),
    target: { screen: "metrics", focusId: metric.id, label: `${metric.name} 보기` },
    targetId: metric.id,
    tone: value?.status === "critical" ? "danger" : value?.status === "warning" ? "warning" : "info"
  };
}

function entityOrEventName(id: string, data: ProjectionData): string {
  const entity = data.entities.find((item) => item.id === id);
  if (entity) {
    return entity.id === "entity-customer-core" ? "핵심 고객군" : entity.name;
  }

  return data.events.find((item) => item.id === id)?.name ?? id;
}

function evidenceIdsFromEntity(entity: EntityInstance, evidenceById: Map<string, EvidenceReference>): string[] {
  const entityEvidenceIds: Record<string, string[]> = {
    "entity-customer-core": ["evidence-claims", "evidence-orders-delay"],
    "entity-low-margin": ["evidence-margin", "evidence-orders-delay", "evidence-claims"],
    "entity-product-control": ["evidence-margin"],
    "entity-product-precision": ["evidence-supplier"],
    "entity-supplier-a": ["evidence-supplier", "evidence-orders-delay"]
  };

  return (entityEvidenceIds[entity.id] ?? []).filter((id) => evidenceById.has(id));
}

function sourceFileIdsFromEvidence(evidenceIds: string[], evidenceById: Map<string, EvidenceReference>): string[] {
  return unique(evidenceIds.map((id) => evidenceById.get(id)?.sourceFileId).filter(Boolean));
}

function statusLabelForInsight(insight?: AIInsight): string {
  if (!insight) {
    return "검토 대기";
  }
  if (insight.status === "proposal_created") {
    return "안건 전환됨";
  }
  if (insight.status === "resolved") {
    return "검토 완료";
  }

  return "검토 대기";
}

function evidenceStrengthLabel(
  evidenceIds: string[],
  evidenceById: Map<string, EvidenceReference>
): string {
  const confidences = evidenceIds
    .map((id) => evidenceById.get(id)?.confidence)
    .filter((value): value is number => typeof value === "number");
  const averageConfidence = average(confidences);

  if (averageConfidence === undefined) {
    return "근거 확인 필요";
  }

  return `근거 신뢰도 ${Math.round(averageConfidence * 100)}%`;
}

function preDecisionChecksForScenario(scenario: SampleResultScenario): string[] {
  const commonChecks = ["원천 파일 행/필드가 최신 업로드와 일치하는지 확인", "실제 실행 전 담당 부서와 영향 범위 확인"];

  if (scenario.id === "supplier") {
    return ["공급업체 A사의 실제 SLA/계약 조건 확인", "대체 공급 가능 품목과 재고 여유 확인", ...commonChecks];
  }
  if (scenario.id === "product") {
    return ["P-42 할인 정책과 반품비용 산식 확인", "P-17/P-08 비교군의 정상 기준 확인", ...commonChecks];
  }
  if (scenario.id === "customer") {
    return ["핵심 고객군 안내/보상 기준의 승인 권한 확인", "클레임 접수 표본이 반복 구매 고객군을 대표하는지 확인", ...commonChecks];
  }

  return commonChecks;
}

function impactSummaryForFile(
  file: SourceFile,
  groups: PhaseOneStructureGroup[],
  decisionCandidateIds: string[]
): string {
  const groupSummary = groups
    .map((group) => `${group.label} ${group.items.length}`)
    .join(" · ");

  if (file.id === "source-margin" || file.name.includes("마진")) {
    return `P-42와 공급업체 A사의 수익성/납품 구조를 만들며 ${groupSummary}, Decision 후보 ${decisionCandidateIds.length}건으로 이어집니다.`;
  }
  if (file.id === "source-orders" || file.name.includes("주문")) {
    return `주문, 배송, 클레임 이벤트가 핵심 고객군과 P-42 리스크를 만들며 ${groupSummary}, Decision 후보 ${decisionCandidateIds.length}건으로 이어집니다.`;
  }

  return `미리보기 필드 기준으로 ${groupSummary}, Decision 후보 ${decisionCandidateIds.length}건의 분석 반영 대기 흐름을 만듭니다.`;
}

function affectedScreensForFile(isOrders: boolean, isMargin: boolean): PhaseOneSignal[] {
  const base = [
    { id: "screen-dashboard", label: "대시보드", value: "요약 갱신", detail: "E/E/R/M/D 카운터와 핵심 신호", tone: "info" as const },
    { id: "screen-insights", label: "인사이트", value: "Decision 후보", detail: "최종 검토 후보와 근거 경로", tone: "warning" as const }
  ];

  if (isOrders) {
    return [
      ...base,
      { id: "screen-workflow", label: "업무 흐름", value: "Event", detail: "출고 지연, 클레임 접수 로그", tone: "danger" },
      { id: "screen-metrics", label: "지표", value: "Metric", detail: "지연률, 클레임률 근거", tone: "danger" }
    ];
  }
  if (isMargin) {
    return [
      ...base,
      { id: "screen-objects", label: "관리 대상", value: "Entity", detail: "P-42, 공급업체 A사 연결", tone: "warning" },
      { id: "screen-metrics", label: "지표", value: "Metric", detail: "마진율, 납품준수율 근거", tone: "danger" }
    ];
  }

  return [
    ...base,
    { id: "screen-vault", label: "데이터 보관함", value: "검수 대기", detail: "필드 매핑과 보정 이력", tone: "neutral" }
  ];
}

function flowStepsForFile(
  file: SourceFile,
  isOrders: boolean,
  isMargin: boolean,
  primarySignals: PhaseOneSignal[]
): PhaseOneSignal[] {
  const focusSignal = isMargin
    ? primarySignals.find((signal) => signal.id === "p42-margin")
    : isOrders
      ? primarySignals.find((signal) => signal.id === "p42-claim-rate")
      : undefined;

  return [
    {
      id: `${file.id}-flow-source`,
      label: "1. 원천 업로드",
      value: "완료",
      detail: `${file.name} · ${file.rowCount.toLocaleString("ko-KR")}행`,
      tone: "success"
    },
    {
      id: `${file.id}-flow-extract`,
      label: "2. 구조 후보 추출",
      value: file.status === "parsed" || file.appliedAt ? "진행" : "대기",
      detail: focusSignal ? `${focusSignal.label} ${focusSignal.value} 신호 포함` : "미리보기 필드 기반 후보 생성",
      tone: file.status === "parsed" || file.appliedAt ? "info" : "neutral"
    },
    {
      id: `${file.id}-flow-review`,
      label: "3. 보정/검수",
      value: file.appliedAt ? "완료" : "필요",
      detail: "변경 전/후 비교와 담당 부서 검토",
      tone: file.appliedAt ? "success" : "warning"
    },
    {
      id: `${file.id}-flow-apply`,
      label: "4. 분석에 반영",
      value: file.appliedAt ? "반영 완료" : "로컬 상태",
      detail: "Phase 1에서는 실제 컬렉션 교체 없이 UI 상태만 표시",
      tone: file.appliedAt ? "success" : "info"
    }
  ];
}

function summaryDetailForKind(kind: PhaseOneStructureKind): string {
  const details: Record<PhaseOneStructureKind, string> = {
    decision: "관리자 최종 검토 전 후보",
    entity: "상품, 공급사, 고객군",
    event: "주문, 출고, 클레임 흐름",
    metric: "마진, 지연, 클레임 지표",
    relation: "Entity/Event 사이 연결"
  };

  return details[kind];
}

function parseRows(file?: SourceFile): Array<Record<string, string>> {
  if (!file?.previewColumns || !file.previewRows) {
    return [];
  }

  return file.previewRows.map((row) =>
    Object.fromEntries(file.previewColumns?.map((column, index) => [column, row[index] ?? ""]) ?? [])
  );
}

function hasClaim(row: Record<string, string>): boolean {
  const claimType = String(row["클레임유형"] ?? "").trim();
  const claimStatus = String(row["클레임상태"] ?? "").trim();

  return Boolean(claimType) || (Boolean(claimStatus) && claimStatus !== "없음");
}

function findSourceFile(sourceFiles: SourceFile[], exactName: string, nameKeyword: string): SourceFile | undefined {
  return sourceFiles.find((file) => file.name === exactName) ?? sourceFiles.find((file) => file.name.includes(nameKeyword));
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value.replace(/[,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePercent(value: string | undefined): number | undefined {
  return parseNumber(value);
}

function average(values: Array<number | undefined>): number | undefined {
  const validValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (validValues.length === 0) {
    return undefined;
  }

  return sum(validValues) / validValues.length;
}

function sum(values: Array<number | undefined>): number {
  return values.reduce<number>((total, value) => total + (typeof value === "number" && Number.isFinite(value) ? value : 0), 0);
}

function rate(count: number, total: number): number | undefined {
  if (total <= 0) {
    return undefined;
  }

  return (count / total) * 100;
}

function formatPercentLabel(value: number | undefined, defaultLabel: string): string {
  return value === undefined ? defaultLabel : `${formatOne(value)}%`;
}

function formatRevenue(value: number): string {
  if (value >= 100_000_000) {
    return `${formatOne(value / 100_000_000)}억`;
  }

  return `${Math.round(value / 1_000_000).toLocaleString("ko-KR")}M`;
}

function formatOne(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function normalizeManagerFacingCopy(value: string): string {
  return value.replaceAll("고객A", "핵심 고객군");
}

function orderByPreferred<T extends { id: string }>(items: T[], preferredIds: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const preferredItems = preferredIds.map((id) => byId.get(id)).filter((item): item is T => Boolean(item));
  const remainingItems = items.filter((item) => !preferredIds.includes(item.id));

  return [...preferredItems, ...remainingItems];
}

function unique<T>(items: Array<T | undefined>): T[] {
  return Array.from(new Set(items.filter((item): item is T => item !== undefined)));
}
