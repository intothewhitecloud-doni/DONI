"use client";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { buildProposalDraftFromInsight } from "../../lib/domain/result-scenarios";
import type { EvidenceReference } from "../../lib/domain/types";
import { can } from "../../lib/prototype/permissions";
import { proposalVoterUserIds } from "../../lib/prototype/policy";
import { activeInsight, evidenceById } from "../../lib/prototype/selectors";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

export function InsightsScreen() {
  const { commands, state } = usePrototype();
  const hasFiles = state.sourceFiles.length > 0;
  const canPrepareAnalysis = can(state.session.role, "source:upload") && can(state.session.role, "analysis:start");

  if (state.insights.length === 0) {
    return (
      <div className="space-y-8">
        <SectionTitle eyebrow="인공지능 인사이트" title="아직 분석된 운영 신호가 없습니다" description="운영 신호는 파일 분석과 후보 검토가 끝난 뒤 지표와 연결 관계를 바탕으로 생성됩니다." />
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
          <div className="grid gap-3 md:grid-cols-4">
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
      <SectionTitle eyebrow="인공지능 인사이트" title="검토가 필요한 운영 신호" description="인공지능은 결정을 내리지 않고, 근거와 함께 검토할 신호를 제안합니다." />
      <div className="grid gap-4 lg:grid-cols-2">
        {state.insights.map((insight) => (
          <Card key={insight.id} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <Badge tone={insight.severity === "high" ? "danger" : "warning"}>{insight.severity === "high" ? "높은 영향" : "검토"}</Badge>
              <Badge tone={insight.status === "proposal_created" ? "success" : "info"}>
                {insight.status === "proposal_created" ? "안건 생성됨" : insight.status === "resolved" ? "해결됨" : "신규"}
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-slate-950">{insight.title}</h2>
            <p className="text-sm leading-6 text-slate-600">{insight.detected}</p>
            <Button onClick={() => commands.navigateToTarget({ screen: "insightDetail", focusId: insight.id, label: "상세 근거 보기" })}>
              상세 근거 보기
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
  const canCreateProposal = can(state.session.role, "insight:proposal");

  if (!insight) {
    return (
      <div className="space-y-8">
        <SectionTitle
          eyebrow="인사이트"
          title="아직 분석된 운영 신호가 없습니다"
          description="소스 데이터를 업로드하고 후보 검토를 완료하면 연결 관계와 지표에 연결된 운영 신호가 표시됩니다."
        />
        <Button onClick={() => commands.navigate("dashboard")}>대시보드로 이동</Button>
      </div>
    );
  }

  const linkedMetrics = state.metricDefinitions.filter((metric) => insight.relatedMetricIds.includes(metric.id));
  const linkedObjects = state.entities.filter((entity) => insight.relatedObjectIds.includes(entity.id));
  const linkedEvents = state.events.filter((event) => insight.relatedEventIds.includes(event.id));
  const linkedRelations = state.relations.filter((relation) => insight.relatedRelationIds.includes(relation.id));
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
      <SectionTitle eyebrow="인사이트 > 인사이트 상세" title={insight.title} description="탐지 내용, 원인 후보, 추천 조치, 증거를 함께 검토합니다." />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="space-y-5">
          <div>
            <Badge tone="danger">높은 영향</Badge>
            <h2 className="mt-3 text-lg font-bold text-slate-950">무엇이 감지되었나요?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{insight.detected}</p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-950">왜 중요한가요?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{insight.reason}</p>
          </div>
          {insight.supportSummary && insight.supportSummary.length > 0 && (
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
              <h3 className="font-bold text-slate-900">근거 조합</h3>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
                {insight.supportSummary.map((summary) => <li key={summary}>{summary}</li>)}
              </ul>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-bold text-slate-900">원인 후보</h3>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {insight.likelyCauses.map((cause) => <li key={cause}>• {cause}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">추천 조치</h3>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {insight.recommendedActions.map((action) => <li key={action}>• {action}</li>)}
              </ul>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <LinkedInsightGroup title="연결 지표" items={linkedMetricItems} />
            <LinkedInsightGroup title="관리 대상" items={linkedObjects.map((object) => `${object.kind} · ${object.name}`)} />
            <LinkedInsightGroup title="업무 이벤트" items={linkedEvents.map((event) => `${event.name} · ${event.workflowType || "미지정"}`)} />
            <LinkedInsightGroup title="연결 관계" items={linkedRelationItems} />
          </div>
          {canCreateProposal && (
            <Button onClick={() => commands.createProposalFromInsight(insight.id)}>
              이 인사이트로 안건 만들기
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
    </div>
  );
}

function LinkedInsightGroup({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
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
  const canCreateProposal = can(state.session.role, "insight:proposal");
  const voterUserIds = proposalVoterUserIds(state, state.session.workspaceId);

  if (!insight) {
    return (
      <div className="space-y-8">
        <SectionTitle
          eyebrow="인사이트 > 안건 초안"
          title="안건으로 전환할 인사이트가 없습니다"
          description="연결 관계와 지표 분석을 먼저 완료하면 시스템이 검토 가능한 안건 후보를 제안합니다."
        />
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
      <SectionTitle eyebrow="인사이트 > 안건 초안" title="운영 조정안을 생성합니다" description="인사이트의 근거를 바탕으로 투표 가능한 안건을 만듭니다." />
      <Card className="space-y-4">
        <Badge tone="info">인사이트 기반</Badge>
        <h2 className="text-xl font-bold text-slate-950">{draft.title}</h2>
        <p className="text-sm leading-6 text-slate-600">{draft.summary}</p>
        <p className="text-sm leading-6 text-slate-600">예상 효과: {draft.expectedImpact}</p>
        {canCreateProposal && <Button onClick={() => commands.createProposalFromInsight(insight.id)}>안건 생성 후 투표로 이동</Button>}
      </Card>
    </div>
  );
}
