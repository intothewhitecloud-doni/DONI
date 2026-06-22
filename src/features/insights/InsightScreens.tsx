"use client";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { buildProposalDraftFromInsight } from "../../lib/domain/result-scenarios";
import type { EvidenceReference } from "../../lib/domain/types";
import { canCurrentUser } from "../../lib/prototype/permissions";
import { proposalVoterUserIds } from "../../lib/prototype/policy";
import { getPhaseOneAnalysisProjection, type PhaseOneDecisionCandidate } from "../../lib/prototype/queries/phaseOneAnalysisProjection";
import { activeInsight, evidenceById } from "../../lib/prototype/selectors";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

export function InsightsScreen() {
  const { commands, state } = usePrototype();
  const phaseOneProjection = getPhaseOneAnalysisProjection(state);
  const hasFiles = state.sourceFiles.length > 0;
  const canPrepareAnalysis = canCurrentUser(state, "source:upload") && canCurrentUser(state, "analysis:start");

  if (state.insights.length === 0) {
    return (
      <div className="space-y-8">
        <SectionTitle title="인사이트" />
        <Card className="space-y-4 border-dashed bg-slate-50">
          <Badge tone="neutral">준비 필요</Badge>
          <div>
            <h2 className="text-xl font-bold text-slate-950">{hasFiles ? "파일 분석이 필요합니다" : "등록된 파일이 없습니다"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {hasFiles
                ? "추가된 파일을 분석하고 후보를 확정하면 검토가 필요한 운영 신호가 표시됩니다."
                : "데이터 보관함에 업무 파일을 추가하면 운영 신호를 분석할 수 있습니다."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {["파일 추가", "구조 분석", "후보 확정", "운영 신호 생성"].map((step, index) => (
              <div key={step} className="rounded-md border border-slate-200 bg-white p-3">
                <Badge tone={index === 0 ? "warning" : "neutral"}>{index === 0 ? "다음 단계" : "대기"}</Badge>
                <p className="mt-2 text-sm font-semibold text-slate-900">{step}</p>
              </div>
            ))}
          </div>
          {canPrepareAnalysis && (
            <Button onClick={hasFiles ? commands.uploadSampleFiles : () => commands.navigate("vault")}>
              {hasFiles ? "업로드 및 분석 시작" : "데이터 보관함에서 파일 추가"}
            </Button>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionTitle title="인사이트" />
      <Card className="space-y-3" density="compact">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge tone="warning">Decision 후보 최종 검토</Badge>
            <h2 className="mt-3 text-xl font-bold text-slate-950">분석 결과를 안건으로 전환하기 전 확인할 후보</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Entity, Event, Relation, Metric 근거가 연결된 후보만 이 화면에서 검토합니다.
            </p>
          </div>
          <Badge tone="info">{phaseOneProjection.decisionCandidates.length}건</Badge>
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {phaseOneProjection.decisionCandidates.map((candidate) => (
          <Card key={candidate.id} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <Badge tone={candidate.impactLabel === "높은 영향" ? "danger" : "warning"}>{candidate.impactLabel}</Badge>
              <Badge tone={candidate.statusLabel === "안건 전환됨" ? "success" : "info"}>{candidate.statusLabel}</Badge>
            </div>
            <h2 className="text-xl font-bold text-slate-950">{candidate.title}</h2>
            <p className="text-sm leading-6 text-slate-600">{candidate.summary}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <InlineReviewFact label="근거" value={candidate.evidenceStrengthLabel} />
              <InlineReviewFact label="예상 효과" value={candidate.expectedImpact} />
            </div>
            <Button onClick={() => commands.navigateToTarget(candidate.target)}>
              Decision 후보 검토
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function InsightDetailScreen() {
  const { commands, state } = usePrototype();
  const insight = activeInsight(state);
  const phaseOneProjection = getPhaseOneAnalysisProjection(state);
  const canCreateProposal = canCurrentUser(state, "insight:proposal");

  if (!insight) {
    return (
      <div className="space-y-8">
        <SectionTitle title="인사이트" />
        <Button onClick={() => commands.navigate("dashboard")}>대시보드로 이동</Button>
      </div>
    );
  }

  const decisionCandidate = phaseOneProjection.decisionCandidates.find((candidate) => candidate.id === insight.id);
  const relatedMetricIds = decisionCandidate?.relatedMetricIds ?? insight.relatedMetricIds;
  const relatedObjectIds = decisionCandidate?.relatedObjectIds ?? insight.relatedObjectIds;
  const relatedEventIds = decisionCandidate?.relatedEventIds ?? insight.relatedEventIds;
  const relatedRelationIds = decisionCandidate?.relatedRelationIds ?? insight.relatedRelationIds;
  const linkedMetrics = state.metricDefinitions.filter((metric) => relatedMetricIds.includes(metric.id));
  const linkedObjects = state.entities.filter((entity) => relatedObjectIds.includes(entity.id));
  const linkedEvents = state.events.filter((event) => relatedEventIds.includes(event.id));
  const linkedRelations = state.relations.filter((relation) => relatedRelationIds.includes(relation.id));
  const linkedMetricItems = linkedMetrics.map((metric) => {
    const value = state.metricValues.find((item) => item.metricId === metric.id);
    return `${metric.name}: ${value?.value ?? "-"}${metric.unit}`;
  });
  const linkedRelationItems = linkedRelations.map((relation) => {
    const from = state.entities.find((entity) => entity.id === relation.fromId)?.name ?? relation.fromId;
    const to = state.entities.find((entity) => entity.id === relation.toId)?.name ?? relation.toId;
    const confidence = typeof relation.confidence === "number" ? ` · 신뢰도 ${Math.round(relation.confidence * 100)}%` : "";
    const metrics = state.metricDefinitions.filter((metric) => relation.metricIds?.includes(metric.id)).map((metric) => metric.name);
    return `${from} → ${to} · ${relation.type}${confidence} · 지표 ${metrics.join(", ") || "없음"}`;
  });

  return (
    <div className="space-y-8">
      <SectionTitle breadcrumb={["인사이트", "인사이트 상세"]} title="인사이트" />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={decisionCandidate?.impactLabel === "높은 영향" ? "danger" : "warning"}>
                {decisionCandidate?.impactLabel ?? "검토 필요"}
              </Badge>
              <Badge tone="info">{decisionCandidate?.evidenceStrengthLabel ?? "근거 확인"}</Badge>
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-950">{decisionCandidate?.title ?? insight.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{decisionCandidate?.summary ?? insight.detected}</p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-950">왜 검토해야 하나요?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{insight.reason}</p>
            {decisionCandidate && (
              <p className="mt-2 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold leading-6 text-emerald-800">
                예상 효과: {decisionCandidate.expectedImpact}
              </p>
            )}
          </div>
          <EvidencePathPanel
            decisionCandidate={decisionCandidate}
            linkedEvents={linkedEvents.map((event) => event.name)}
            linkedMetrics={linkedMetricItems}
            linkedObjects={linkedObjects.map((object) => `${object.kind} · ${object.id === "entity-customer-core" ? "핵심 고객군" : object.name}`)}
            linkedRelations={linkedRelationItems}
          />
          {insight.supportSummary && insight.supportSummary.length > 0 && (
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
              <h3 className="font-bold text-slate-900">근거 조합</h3>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
                {insight.supportSummary.map((summary) => <li key={summary}>{summary}</li>)}
              </ul>
            </div>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <h3 className="font-bold text-slate-900">위험/주의점</h3>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {(decisionCandidate?.risks ?? insight.likelyCauses).map((cause) => <li key={cause}>• {cause}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">실행 전 확인 항목</h3>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {(decisionCandidate?.preDecisionChecks ?? insight.recommendedActions).map((action) => <li key={action}>• {action}</li>)}
              </ul>
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <LinkedInsightGroup title="연결 지표" items={linkedMetricItems} />
            <LinkedInsightGroup title="관리 대상" items={linkedObjects.map((object) => `${object.kind} · ${object.name}`)} />
            <LinkedInsightGroup title="업무 이벤트" items={linkedEvents.map((event) => `${event.name} · ${event.workflowType || "미지정"}`)} />
            <LinkedInsightGroup title="연결 관계" items={linkedRelationItems} />
          </div>
          {canCreateProposal && (
            <Button onClick={() => commands.createProposalFromInsight(insight.id)}>
              Decision 후보를 안건으로 전환
            </Button>
          )}
        </Card>
        <Card className="space-y-4">
          <h2 className="text-lg font-bold text-slate-950">연결 근거</h2>
          {insight.evidenceIds.map((evidenceId) => {
            const evidence = evidenceById(state, evidenceId);
            return (
              <div key={evidenceId} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">{evidence?.label}</p>
                <p className="mt-1 text-xs text-slate-500">{evidence ? formatInsightEvidenceSource(evidence) : ""}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{evidence?.excerpt}</p>
              </div>
            );
          })}
        </Card>
      </div>
      <div className="flex justify-start">
        <Button variant="secondary" onClick={() => commands.navigate("insights")}>목록으로 돌아가기</Button>
      </div>
    </div>
  );
}

function LinkedInsightGroup({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
        {items.map((item) => <li key={item} className="break-words">{item}</li>)}
      </ul>
    </div>
  );
}

function InlineReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-900">{value}</p>
    </div>
  );
}

function EvidencePathPanel({
  decisionCandidate,
  linkedEvents,
  linkedMetrics,
  linkedObjects,
  linkedRelations
}: {
  decisionCandidate?: PhaseOneDecisionCandidate;
  linkedEvents: string[];
  linkedMetrics: string[];
  linkedObjects: string[];
  linkedRelations: string[];
}) {
  const pathItems = [
    { label: "Entity", value: linkedObjects.slice(0, 2).join(" / ") || "연결 Entity 없음" },
    { label: "Event", value: linkedEvents.slice(0, 2).join(" / ") || "연결 Event 없음" },
    { label: "Relation", value: linkedRelations.slice(0, 2).join(" / ") || "연결 Relation 없음" },
    { label: "Metric", value: linkedMetrics.slice(0, 2).join(" / ") || "연결 Metric 없음" },
    { label: "Decision", value: decisionCandidate?.title ?? "Decision 후보" }
  ];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900">근거 경로</h3>
        <Badge tone="info">E/E/R/M/D</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-5">
        {pathItems.map((item) => (
          <div key={item.label} className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <p className="text-xs font-bold text-slate-500">{item.label}</p>
            <p className="mt-1 line-clamp-3 text-xs font-semibold leading-5 text-slate-800">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatInsightEvidenceSource(evidence: EvidenceReference): string {
  const source = evidence.sourceKind === "canonical_sample" ? "보관 파일" : "업로드 파일";
  const rows = evidence.rowNumbers && evidence.rowNumbers.length > 0 ? `${evidence.rowNumbers.join(", ")}행` : undefined;
  const columns = evidence.columns && evidence.columns.length > 0 ? evidence.columns.join(", ") : undefined;

  return [source, evidence.sourceName ?? evidence.location, evidence.sheetName, rows, columns].filter(Boolean).join(" · ");
}

export function ProposalCreateScreen() {
  const { commands, state } = usePrototype();
  const insight = activeInsight(state);
  const canCreateProposal = canCurrentUser(state, "insight:proposal");
  const voterUserIds = proposalVoterUserIds(state);

  if (!insight) {
    return (
      <div className="space-y-8">
        <SectionTitle title="인사이트" />
        <Button onClick={() => commands.navigate("dashboard")}>대시보드로 이동</Button>
      </div>
    );
  }

  const draft = buildProposalDraftFromInsight({
    authorId: state.session.currentUserId,
    createdAt: "2026-05-07T09:00:00.000Z",
    voterUserIds: voterUserIds.length > 0 ? voterUserIds : [state.session.currentUserId],
    insight
  });

  return (
    <div className="space-y-8">
      <SectionTitle breadcrumb={["인사이트", "안건 초안"]} title="인사이트" />
      <Card className="space-y-4">
        <Badge tone="info">Decision 후보 기반</Badge>
        <h2 className="text-xl font-bold text-slate-950">{draft.title}</h2>
        <p className="text-sm leading-6 text-slate-600">{draft.summary}</p>
        <p className="text-sm leading-6 text-slate-600">예상 효과: {draft.expectedImpact}</p>
        {canCreateProposal && <Button onClick={() => commands.createProposalFromInsight(insight.id)}>Decision 후보 안건 생성 후 투표로 이동</Button>}
      </Card>
    </div>
  );
}
