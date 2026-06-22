"use client";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { MetricChart } from "../../components/ui/MetricChart";
import { canCurrentUser } from "../../lib/prototype/permissions";
import { getDashboardView } from "../../lib/prototype/queries/dashboardQueries";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

type DashboardView = ReturnType<typeof getDashboardView>;
type PrototypeCommands = ReturnType<typeof usePrototype>["commands"];
type DashboardTone = "success" | "warning" | "danger" | "info" | "neutral";

export function DashboardScreen() {
  const { commands, state } = usePrototype();
  const view = getDashboardView(state);
  const hasDefinitions = state.entities.length > 0 && state.events.length > 0;
  const canUploadSource = canCurrentUser(state, "source:upload");
  const canOpenInsightDetail = canCurrentUser(state, "insight:proposal");

  if (!hasDefinitions) {
    return (
      <div className="space-y-8">
        <SectionTitle title="대시보드" />
        <Card className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {["관리 대상", "업무 이벤트", "연결 관계", "지표", "의사결정 안건"].map((item, index) => (
              <div key={item} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <Badge tone={index < 2 ? "warning" : "neutral"}>{index < 2 ? "정의 필요" : "대기"}</Badge>
                <p className="mt-3 text-lg font-bold text-slate-950">{item}</p>
              </div>
            ))}
          </div>
          <p className="text-sm leading-6 text-slate-600">
            관리 대상과 업무 이벤트를 정의하면 지표와 안건 추천이 활성화됩니다.
          </p>
          {canUploadSource ? (
            <Button onClick={() => commands.navigate("vault")}>데이터 보관함에서 파일 추가</Button>
          ) : (
            <p className="rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600">
              운영 담당자의 파일 분석 후 의사결정 흐름이 표시됩니다.
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionTitle title="대시보드" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {view.summaryCards.map((card) => (
          <MetricCard
            key={card.label}
            card={card}
            onOpen={card.target ? () => commands.navigateToTarget(card.target!) : undefined}
          />
        ))}
      </div>

      <PhaseOneOverviewPanel commands={commands} view={view} />

      <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <Card className="min-w-0 space-y-3" density="compact">
          <MainInsightPanel canOpenInsightDetail={canOpenInsightDetail} commands={commands} view={view} />
        </Card>

        <Card className="min-w-0 space-y-3" density="compact">
          <SourceCoveragePanel commands={commands} items={view.sourceCoverage} />
        </Card>
      </div>

      <DashboardSnapshotGrid commands={commands} view={view} />

      <WorkflowTimelinePanel commands={commands} view={view} />

      <DecisionResultsPanel commands={commands} items={view.activeDecisionItems} />
    </div>
  );
}

function SectionHeader({
  action,
  badge,
  title
}: {
  action?: React.ReactNode;
  badge?: string;
  title: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-title-md text-slate-950" title={title}>{title}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge && <Badge tone="neutral">{badge}</Badge>}
        {action}
      </div>
    </div>
  );
}

function PhaseOneOverviewPanel({
  commands,
  view
}: {
  commands: PrototypeCommands;
  view: DashboardView;
}) {
  const topDecisionCandidates = view.phaseOne.decisionCandidates.slice(0, 3);

  return (
    <Card className="min-w-0 space-y-4" density="compact">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-title-md text-slate-950">운영 구조 요약</h2>
            <Badge tone="info">Entity - Event - Relation - Metric - Decision</Badge>
          </div>
          <p className="mt-2 text-sm leading-5 text-slate-600">
            파일에서 추출된 구조 후보와 P-42/A사 핵심 신호를 같은 기준으로 요약합니다.
          </p>
        </div>
        <Button className="h-8 px-3" variant="secondary" onClick={() => commands.navigate("vault")}>
          원천 확인
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {view.phaseOne.summary.map((item) => (
          <div
            key={item.id}
            className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3"
          >
            <Badge tone={item.tone}>{item.label}</Badge>
            <p className="mt-2 text-xl font-bold text-slate-950">{item.value}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {view.phaseOne.primarySignals.map((signal) => (
            <button
              key={signal.id}
              className="min-w-0 rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:shadow-sm"
              type="button"
              onClick={() => signal.target ? commands.navigateToTarget(signal.target) : commands.navigate("dashboard")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold text-slate-500" title={signal.label}>{signal.label}</p>
                <Badge tone={signal.tone}>{signal.tone === "danger" ? "주의" : "신호"}</Badge>
              </div>
              <p className="mt-2 text-lg font-bold text-slate-950">{signal.value}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">{signal.detail}</p>
            </button>
          ))}
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-950">검토 대기 Decision 후보</p>
            <Badge tone="warning">{topDecisionCandidates.length}건</Badge>
          </div>
          <div className="mt-3 space-y-2">
            {topDecisionCandidates.map((candidate) => (
              <button
                key={candidate.id}
                className="w-full min-w-0 rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:shadow-sm"
                type="button"
                onClick={() => commands.navigateToTarget(candidate.target)}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-bold leading-5 text-slate-950">{candidate.title}</p>
                  <Badge tone={candidate.impactLabel === "높은 영향" ? "danger" : "warning"}>{candidate.statusLabel}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{candidate.summary}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">{candidate.evidenceStrengthLabel}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MainInsightPanel({
  canOpenInsightDetail,
  commands,
  view
}: {
  canOpenInsightDetail: boolean;
  commands: PrototypeCommands;
  view: DashboardView;
}) {
  return (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-title-md text-slate-950">주요 운영 신호</h2>
            <Badge tone={view.mainInsight?.severity === "high" ? "danger" : "warning"}>
              {view.mainInsight?.severity === "high" ? "높은 영향" : "검토 필요"}
            </Badge>
          </div>
          <p className="mt-2 text-title-md leading-6 text-slate-950">{view.mainInsight?.title ?? "검토할 인사이트가 없습니다"}</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">{view.mainInsight?.detected ?? "구조 검토를 확정하면 선택 항목에 맞는 운영 신호가 표시됩니다."}</p>
        </div>
        {canOpenInsightDetail && view.mainInsight && (
          <Button
            className="h-8 shrink-0 px-3"
            variant="secondary"
            onClick={() => commands.navigateToTarget({ screen: "insightDetail", focusId: view.mainInsight?.id, label: "인사이트 상세 보기" })}
          >
            상세
          </Button>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {view.metricWidgets.slice(0, 3).map((widget) => {
          const currentPoint = widget.points.at(-1);
          return (
            <button
              key={widget.id}
              className="min-w-0 rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:shadow-sm"
              type="button"
              onClick={() => commands.navigateToTarget(widget.target)}
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-slate-700" title={widget.title}>{widget.title}</p>
                <Badge tone={widget.status === "critical" ? "danger" : widget.status === "warning" ? "warning" : "success"}>
                  {chartTypeLabel(widget.chartType)}
                </Badge>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {currentPoint?.value ?? "-"}
                <span className="text-sm text-slate-500">{widget.unit}</span>
              </p>
              <p className="mt-1 truncate text-xs text-slate-500" title={widget.description}>{widget.description}</p>
            </button>
          );
        })}
      </div>

      {view.mainInsight?.recommendedActions && (
        <div className="grid gap-2 md:grid-cols-3">
          {view.mainInsight.recommendedActions.slice(0, 3).map((action, index) => (
            <div key={action} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-bold text-slate-500">조치 {index + 1}</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-800">{action}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SourceCoveragePanel({
  commands,
  items
}: {
  commands: PrototypeCommands;
  items: DashboardView["sourceCoverage"];
}) {
  return (
    <>
      <SectionHeader
        action={<Button className="h-8 px-3" variant="secondary" onClick={() => commands.navigate("vault")}>보관함</Button>}
        badge={`${items.length}개`}
        title="원천 파일 기준"
      />
      <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
        {items.map((item) => (
          <div key={item.id} className="min-w-0 px-3 py-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-bold text-slate-900" title={item.fileName}>{item.fileName}</p>
              <Badge tone={item.tone}>{item.rowCountLabel}</Badge>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">{item.columnsLabel}</p>
            <p className="mt-2 text-sm leading-5 text-slate-700">{item.summary}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function DashboardSnapshotGrid({
  commands,
  view
}: {
  commands: PrototypeCommands;
  view: DashboardView;
}) {
  return (
    <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
      <div className="grid min-w-0 gap-4">
        <Card className="min-w-0 space-y-3" density="compact">
          <SectionHeader
            action={<Button className="h-8 px-3" variant="secondary" onClick={() => commands.navigate("vault")}>원천 보기</Button>}
            badge={`${view.productRows.length}개`}
            title="상품군 수익·클레임"
          />
          <ProductPerformanceTable commands={commands} rows={view.productRows} />
        </Card>

        <Card className="min-w-0 space-y-3" density="compact">
          <OperationalMetricSummary view={view} />
        </Card>
      </div>

      <Card className="min-w-0 space-y-3" density="compact">
        <SectionHeader
          action={<Button className="h-8 px-3" variant="secondary" onClick={() => commands.navigate("objects")}>관리 대상</Button>}
          badge={`${view.supplierRows.length}개`}
          title="공급사 납품 상태"
        />
        <SupplierHealthList commands={commands} rows={view.supplierRows} />
      </Card>
    </div>
  );
}

function OperationalMetricSummary({ view }: { view: DashboardView }) {
  const primaryWidget = view.primaryChartWidgets.length === 1 ? view.primaryChartWidgets[0] : undefined;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-title-md text-slate-950" title={view.primaryChart.title}>{view.primaryChart.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{view.primaryChart.description}</p>
        </div>
        <Badge tone="info">{chartTypeLabel(view.primaryChart.type)}</Badge>
      </div>

      <div className={primaryWidget ? "space-y-3" : "grid min-w-0 gap-3"}>
        {view.primaryChartWidgets.slice(0, 3).map((widget) => (
          <div key={`${widget.id}-snapshot-chart`} className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p className="min-w-0 truncate font-bold text-slate-950" title={widget.title}>{widget.title}</p>
              <Badge tone={widget.status === "critical" ? "danger" : widget.status === "warning" ? "warning" : "success"}>
                {widget.status === "critical" ? "위험" : widget.status === "warning" ? "주의" : "정상"}
              </Badge>
            </div>
            <MetricMiniChart compact={!primaryWidget} widget={widget} />
          </div>
        ))}
        {primaryWidget && (
          <PrimaryChartContext
            insightTitle={view.mainInsight?.title}
            supportSummary={view.mainInsight?.supportSummary ?? []}
            widget={primaryWidget}
          />
        )}
      </div>
    </>
  );
}

function ProductPerformanceTable({
  commands,
  rows
}: {
  commands: PrototypeCommands;
  rows: DashboardView["productRows"];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="min-w-[860px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold text-slate-500">
          <tr>
            <th className="px-3 py-2">상품군</th>
            <th className="px-3 py-2">공급사</th>
            <th className="px-3 py-2 text-right">매출</th>
            <th className="px-3 py-2 text-right">마진</th>
            <th className="px-3 py-2 text-right">반품비용</th>
            <th className="px-3 py-2 text-right">납품준수</th>
            <th className="px-3 py-2 text-right">주문/클레임</th>
            <th className="px-3 py-2 text-right">대기</th>
            <th className="px-3 py-2">상태</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <button
                  className="min-w-0 text-left"
                  type="button"
                  onClick={() => commands.navigateToTarget(row.target)}
                >
                  <span className="block font-bold text-slate-950">{row.productGroup}</span>
                  <span className="block max-w-[190px] truncate text-xs text-slate-500" title={row.productName}>{row.productName}</span>
                </button>
              </td>
              <td className="max-w-[150px] truncate px-3 py-2 text-slate-700" title={row.supplier}>{row.supplier}</td>
              <td className="px-3 py-2 text-right font-semibold text-slate-900">{row.revenueLabel}</td>
              <td className="px-3 py-2 text-right font-semibold text-slate-900">{row.marginRateLabel}</td>
              <td className="px-3 py-2 text-right text-slate-700">{row.returnCostLabel}</td>
              <td className="px-3 py-2 text-right text-slate-700">{row.deliveryComplianceLabel}</td>
              <td className="px-3 py-2 text-right text-slate-700">
                <span className="block">{row.orderCountLabel}</span>
                <span className="text-xs text-slate-500">{row.claimRateLabel}</span>
              </td>
              <td className="px-3 py-2 text-right text-slate-700">{row.waitHoursLabel}</td>
              <td className="px-3 py-2"><Badge tone={row.tone}>{row.statusLabel}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SupplierHealthList({
  commands,
  rows
}: {
  commands: PrototypeCommands;
  rows: DashboardView["supplierRows"];
}) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <button
          key={row.id}
          className="w-full min-w-0 rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:shadow-sm"
          disabled={!row.target}
          type="button"
          onClick={() => row.target && commands.navigateToTarget(row.target)}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-950" title={row.supplier}>{row.supplier}</p>
              <p className="mt-1 truncate text-xs text-slate-500" title={row.productsLabel}>{row.productsLabel}</p>
            </div>
            <Badge tone={row.tone}>{row.riskLabel}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <InlineStat label="매출" value={row.revenueLabel} />
            <InlineStat label="마진" value={row.marginRateLabel} />
            <InlineStat label="납품준수" value={row.deliveryComplianceLabel} />
            <InlineStat label="지연" value={row.delayedOrdersLabel} />
          </div>
          <ProgressBar label={row.waitHoursLabel} tone={row.tone} value={percentFromLabel(row.deliveryComplianceLabel)} />
        </button>
      ))}
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-2 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="ml-1 font-bold text-slate-900">{value}</span>
    </div>
  );
}

function ProgressBar({ label, tone, value }: { label: string; tone: DashboardTone; value: number }) {
  const colorClass: Record<DashboardTone, string> = {
    danger: "bg-rose-500",
    info: "bg-blue-500",
    neutral: "bg-slate-400",
    success: "bg-emerald-500",
    warning: "bg-amber-500"
  };

  return (
    <div className="mt-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${colorClass[tone]}`} style={{ width: `${Math.max(8, Math.min(100, value))}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function WorkflowTimelinePanel({
  commands,
  view
}: {
  commands: PrototypeCommands;
  view: DashboardView;
}) {
  return (
    <Card className="min-w-0 space-y-4" density="compact">
      <SectionHeader
        action={<Button className="h-8 px-3" variant="secondary" onClick={() => commands.navigateToTarget(view.workflowListTarget)}>더보기</Button>}
        badge={`${view.workflowSignals.length}개`}
        title="주문·배송·클레임 흐름"
      />

      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[1040px] grid-cols-6 gap-2">
          {view.workflowSignals.map((signal, index) => (
            <WorkflowTimelineNode
              key={signal.id}
              commands={commands}
              index={index}
              signal={signal}
            />
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-2 md:grid-cols-4">
        {view.recentFlows.slice(0, 4).map((flow) => (
          <div key={flow.id} className="min-w-0 rounded-md border border-slate-200 bg-white p-3">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="truncate text-sm font-bold text-slate-900" title={flow.title}>{flow.title}</p>
              <Badge tone={flow.tone}>{flow.badge}</Badge>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500" title={flow.description}>{flow.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WorkflowTimelineNode({
  commands,
  index,
  signal
}: {
  commands: PrototypeCommands;
  index: number;
  signal: DashboardView["workflowSignals"][number];
}) {
  const className = "flex h-full min-h-[116px] min-w-0 flex-col rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:shadow-sm";
  const content = (
    <>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Badge tone="neutral">{index + 1}단계</Badge>
        <Badge tone={signal.tone}>{signal.value}</Badge>
      </div>
      <p className="mt-3 truncate text-sm font-bold text-slate-950" title={signal.label}>{signal.label}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">{signal.detail}</p>
    </>
  );

  return signal.target ? (
    <button className={className} type="button" onClick={() => commands.navigateToTarget(signal.target!)}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

function DecisionResultsPanel({
  commands,
  items
}: {
  commands: PrototypeCommands;
  items: DashboardView["activeDecisionItems"];
}) {
  return (
    <Card className="min-w-0 space-y-3" density="compact">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="truncate text-title-md text-slate-950">전환된 안건/확정 결과</h2>
        <Badge tone={items.length > 0 ? "success" : "neutral"}>{items.length}건</Badge>
      </div>
      {items.length > 0 ? (
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          {items.map((item) => (
            <button
              key={item.id}
              className="w-full min-w-0 rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:shadow-sm"
              type="button"
              onClick={() => commands.navigateToTarget(item.target)}
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="truncate text-sm font-bold text-slate-950" title={item.title}>{item.title}</p>
                <Badge tone={item.tone}>{item.badge}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">{item.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-slate-200 bg-white p-3 text-sm leading-5 text-slate-600">
          안건으로 전환되면 이곳에 누적됩니다.
        </p>
      )}
    </Card>
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
  compact = true,
  widget
}: {
  compact?: boolean;
  widget: DashboardView["metricWidgets"][number];
}) {
  return <MetricChart compact={compact} chartType={widget.chartType} id={widget.id} points={widget.points} status={widget.status} unit={widget.unit} />;
}

function PrimaryChartContext({
  insightTitle,
  supportSummary,
  widget
}: {
  insightTitle?: string;
  supportSummary: string[];
  widget: DashboardView["metricWidgets"][number];
}) {
  const summaryPoints = widget.chartType === "time_series" ? sortSeriesPoints(widget.points) : widget.points;
  const currentPoint = summaryPoints.at(-1);
  const previousValue = currentPoint?.previousValue ?? summaryPoints[0]?.value;
  const delta = currentPoint && previousValue !== undefined ? currentPoint.value - previousValue : undefined;
  const period = widget.chartType === "time_series" ? formatSeriesPeriod(summaryPoints) : undefined;
  const statusLabel = widget.status === "critical" ? "위험" : widget.status === "warning" ? "주의" : "정상";

  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-950">차트 요약</p>
        <Badge tone={widget.status === "critical" ? "danger" : widget.status === "warning" ? "warning" : "success"}>{statusLabel}</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <SummaryStat label="현재" value={formatMetricValue(currentPoint?.value, widget.unit)} />
        <SummaryStat label="이전" value={formatMetricValue(previousValue, widget.unit)} />
        <SummaryStat label="변화" value={formatDelta(delta, widget.unit)} />
        {period && <SummaryStat label="기간" value={period} />}
      </div>
      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-bold text-slate-500">연결 인사이트</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-slate-900">{insightTitle ?? "연결 인사이트 없음"}</p>
      </div>
      {supportSummary.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
          {supportSummary.slice(0, 2).map((summary) => <li key={summary}>{summary}</li>)}
        </ul>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-2">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-base font-bold text-slate-950" title={value}>{value}</p>
    </div>
  );
}

function formatMetricValue(value: number | undefined, unit: string): string {
  if (value === undefined) {
    return "-";
  }

  return `${formatNumber(value)}${unit}`;
}

function formatDelta(delta: number | undefined, unit: string): string {
  if (delta === undefined) {
    return "-";
  }

  return `${delta > 0 ? "+" : ""}${formatNumber(delta)}${unit}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatSeriesPeriod(points: DashboardView["metricWidgets"][number]["points"]): string | undefined {
  const datedPoints = sortSeriesPoints(points.filter((point) => point.observedAt));

  if (datedPoints.length === 0) {
    return undefined;
  }

  const first = datedPoints[0];
  const last = datedPoints[datedPoints.length - 1];

  return first.label === last.label ? first.label : `${first.label} ~ ${last.label}`;
}

function sortSeriesPoints(points: DashboardView["metricWidgets"][number]["points"]) {
  return [...points].sort((left, right) => {
    const leftTime = left.observedAt ? Date.parse(left.observedAt) : Number.NaN;
    const rightTime = right.observedAt ? Date.parse(right.observedAt) : Number.NaN;

    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) {
      return leftTime - rightTime;
    }

    return left.label.localeCompare(right.label);
  });
}

function MetricCard({
  card,
  onOpen
}: {
  card: DashboardView["summaryCards"][number];
  onOpen?: () => void;
}) {
  const className = "min-w-0 rounded-lg border border-hairline bg-surface-card p-3 text-left shadow-soft transition hover:shadow-md";
  const content = (
    <>
      <Badge tone={card.tone}>{card.label}</Badge>
      <p className="mt-3 truncate text-2xl font-bold text-slate-950" title={card.value}>{card.value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">{card.detail}</p>
    </>
  );

  return onOpen ? (
    <button className={className} type="button" onClick={onOpen}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

function percentFromLabel(label: string): number {
  const parsed = Number.parseFloat(label.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
