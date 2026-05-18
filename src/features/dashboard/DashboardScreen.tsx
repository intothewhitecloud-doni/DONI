"use client";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { MetricChart } from "../../components/ui/MetricChart";
import { can } from "../../lib/prototype/permissions";
import { getDashboardView } from "../../lib/prototype/queries/dashboardQueries";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

export function DashboardScreen() {
  const { commands, state } = usePrototype();
  const view = getDashboardView(state);
  const hasDefinitions = state.entities.length > 0 && state.events.length > 0;
  const canUploadSource = can(state.session.role, "source:upload");
  const canOpenInsightDetail = can(state.session.role, "insight:proposal");

  if (!hasDefinitions) {
    return (
      <div className="space-y-8">
        <SectionTitle
          eyebrow="대시보드"
          title="아직 정의된 관리 대상과 업무 이벤트가 없습니다"
          description="업무 데이터를 업로드하면 관리 대상과 업무 이벤트를 먼저 정리하고, 이어서 연결 관계와 지표를 분석해 의사결정 안건을 추천합니다."
        />
        <Card className="space-y-5">
          <div className="grid gap-4 md:grid-cols-5">
            {["관리 대상", "업무 이벤트", "연결 관계", "지표", "의사결정 안건"].map((item, index) => (
              <div key={item} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <Badge tone={index < 2 ? "warning" : "neutral"}>{index < 2 ? "정의 필요" : "대기"}</Badge>
                <p className="mt-3 text-lg font-bold text-slate-950">{item}</p>
              </div>
            ))}
          </div>
          <p className="text-sm leading-6 text-slate-600">
            첫 분석은 관리 대상과 업무 이벤트 정의에서 시작합니다. 이후 연결 관계와 지표를 확인하면 시스템이 실행 가능한 의사결정 안건을 추천합니다.
          </p>
          {canUploadSource ? (
            <Button onClick={() => commands.navigate("vault")}>데이터 보관함에서 파일 추가</Button>
          ) : (
            <p className="rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600">
              운영 담당자가 업무 파일을 추가하고 분석을 완료하면 이 대시보드에서 의사결정 흐름을 확인할 수 있습니다.
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="운영 관찰"
        title={`${state.company.name} 의사결정 상황`}
        description="확정된 데이터 구조를 바탕으로 지표, 업무 이벤트, 연결 관계, 인사이트를 한 화면에서 추적합니다."
      />
      <div className="grid gap-6 md:grid-cols-4">
        {view.summaryCards.map((card, index) => (
          <MetricCard key={card.label} label={card.label} value={card.value} tone={card.tone} delay={(index + 1) / 10} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card delay={0.5} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-title-md text-slate-950">주요 인사이트</h2>
            <Badge tone={view.mainInsight?.severity === "high" ? "danger" : "warning"}>
              {view.mainInsight?.severity === "high" ? "높은 영향" : "검토 필요"}
            </Badge>
          </div>
          <p className="text-title-lg text-slate-950">{view.mainInsight?.title ?? "검토할 인사이트가 없습니다"}</p>
          <p className="text-body-sm text-slate-600">{view.mainInsight?.detected ?? "구조 검토를 확정하면 선택 항목에 맞는 운영 신호가 표시됩니다."}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {view.metricWidgets.map((widget) => {
              const currentPoint = widget.points.at(-1);
              return (
                <button
                  key={widget.id}
                  className="rounded-md border border-hairline bg-white p-3 text-left shadow-sm transition hover:shadow-md"
                  onClick={() => commands.navigateToTarget(widget.target)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">{widget.title}</p>
                    <Badge tone={widget.status === "critical" ? "danger" : widget.status === "warning" ? "warning" : "success"}>
                      {chartTypeLabel(widget.chartType)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {currentPoint?.value ?? "-"}
                    <span className="text-sm text-slate-500">{widget.unit}</span>
                  </p>
                </button>
              );
            })}
          </div>
          {canOpenInsightDetail && view.mainInsight && (
            <Button onClick={() => commands.navigateToTarget({ screen: "insightDetail", focusId: view.mainInsight.id, label: "인사이트 상세 보기" })}>
              인사이트 상세 보기
            </Button>
          )}
        </Card>
        <Card delay={0.6} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-title-md text-slate-950">최근 흐름</h2>
            <Button variant="secondary" onClick={() => commands.navigateToTarget(view.workflowListTarget)}>
              더보기
            </Button>
          </div>
          {view.recentFlows.map((flow) => (
            <div
              key={flow.id}
              className="rounded-md border border-hairline bg-white p-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-title-sm text-slate-900">{flow.title}</p>
                <Badge tone={flow.tone}>{flow.badge}</Badge>
              </div>
              <p className="mt-1 text-body-sm text-slate-600">{flow.description}</p>
            </div>
          ))}
        </Card>
      </div>
      <Card delay={0.65} className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{view.primaryChart.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{view.primaryChart.description}</p>
          </div>
          <Badge tone="info">{chartTypeLabel(view.primaryChart.type)}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {view.primaryChartWidgets.map((widget) => (
            <div key={`${widget.id}-chart`} className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-slate-950">{widget.title}</p>
                <Badge tone={widget.status === "critical" ? "danger" : widget.status === "warning" ? "warning" : "success"}>
                  {widget.status === "critical" ? "위험" : widget.status === "warning" ? "주의" : "정상"}
                </Badge>
              </div>
              <MetricMiniChart widget={widget} />
            </div>
          ))}
        </div>
      </Card>
      {view.activeDecisionItems.length > 0 && (
        <Card delay={0.9} className="space-y-3">
          <h2 className="text-lg font-bold text-slate-950">진행 중인 의사결정</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {view.activeDecisionItems.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 bg-white p-4">
                <Badge tone={item.tone}>{item.badge}</Badge>
                <p className="mt-3 font-bold text-slate-950">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                <Button className="mt-3" variant="secondary" onClick={() => commands.navigateToTarget(item.target)}>
                  상세 보기
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function chartTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    bar: "막대",
    line: "선",
    pie: "비율",
    table: "표",
    time_series: "시계열"
  };

  return labels[type] ?? "차트";
}

function MetricMiniChart({
  widget
}: {
  widget: ReturnType<typeof getDashboardView>["metricWidgets"][number];
}) {
  return <MetricChart compact chartType={widget.chartType} id={widget.id} points={widget.points} status={widget.status} unit={widget.unit} />;
}

function MetricCard({ label, value, tone, delay = 0 }: { label: string; value: string; tone: "success" | "warning" | "danger" | "info"; delay?: number }) {
  return (
    <Card delay={delay}>
      <Badge tone={tone}>{label}</Badge>
      <p className="mt-4 text-display-sm text-slate-950">{value}</p>
    </Card>
  );
}
