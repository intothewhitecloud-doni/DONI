import {
  chartDescriptionForInsight,
  chartTitleForInsight,
  chartTypeForInsight,
  proposalIdForInsight,
  type DashboardChartType
} from "../../domain/result-scenarios";
import { displayTypeLabel } from "../../domain/type-catalog";
import type { LinkTarget, PrototypeState } from "../../domain/types";
import { currentWorkspaceData } from "../selectors";

type SummaryTone = "success" | "warning" | "danger" | "info";

export type DashboardSummaryCard = {
  label: string;
  value: string;
  tone: SummaryTone;
};

export type DashboardChartPoint = {
  label: string;
  value: number;
  previousValue?: number;
};

export type DashboardMetricWidget = {
  id: string;
  title: string;
  description: string;
  chartType: DashboardChartType;
  unit: string;
  status: "normal" | "warning" | "critical";
  points: DashboardChartPoint[];
  target: LinkTarget;
};

export type DashboardLinkedItem = {
  id: string;
  title: string;
  description: string;
  badge: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  target: LinkTarget;
};

export type DashboardRecentFlowItem = {
  id: string;
  title: string;
  description: string;
  badge: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
};

export function getDashboardView(state: PrototypeState) {
  const data = currentWorkspaceData(state);
  const warningMetricValues = data.metricValues.filter((value) => value.status !== "normal");
  const delayedEvents = data.events.filter((event) => ["지연", "증가", "검토"].includes(displayTypeLabel(event.workflowType)));
  const mainInsight = data.insights.find((insight) => insight.id === data.activeInsightId) ?? data.insights[0];
  const suggestedProposal = mainInsight
    ? data.proposals.find((proposal) => proposal.insightId === mainInsight.id) ?? {
        id: proposalIdForInsight(mainInsight.id),
        title: `${mainInsight.title} 대응 안건`,
        summary: "인사이트 상세에서 안건을 생성하면 투표 흐름으로 이어집니다.",
        insightId: mainInsight.id
      }
    : undefined;

  const metricWidgets = data.metricDefinitions.map<DashboardMetricWidget>((metric, index) => {
    const metricValue = data.metricValues.find((value) => value.metricId === metric.id);
    const chartType = metricValue?.chartType ?? (index === 0 ? chartTypeForInsight(mainInsight?.id) : chartTypeForMetric(metric.id));

    return {
      id: metric.id,
      title: metric.name,
      description: index === 0 ? chartDescriptionForInsight(mainInsight?.id) : metric.formula,
      chartType,
      unit: metric.unit,
      status: metricValue?.status ?? "normal",
      points: buildChartPoints(metric.name, metricValue),
      target: { screen: "metrics", focusId: metric.id, label: `${metric.name} 보기` }
    };
  });

  return {
    summaryCards: [
      {
        label: "관리 대상",
        value: `${data.entities.length}개`,
        tone: "success" as const
      },
      {
        label: "주의 지표",
        value: `${warningMetricValues.length}개`,
        tone: warningMetricValues.some((metric) => metric.status === "critical") ? "danger" as const : "warning" as const
      },
      {
        label: "업무 흐름",
        value: `${data.events.length}건`,
        tone: delayedEvents.length > 0 ? "warning" as const : "info" as const
      },
      {
        label: "의사결정",
        value: `${data.decisions.length || data.proposals.length}건`,
        tone: data.decisions.length > 0 ? "success" as const : "info" as const
      }
    ] satisfies DashboardSummaryCard[],
    mainInsight,
    suggestedProposal,
    metricWidgets,
    workflowListTarget: { screen: "workflow", label: "업무 흐름 목록 보기" } satisfies LinkTarget,
    recentFlows: data.events.map<DashboardRecentFlowItem>((event) => ({
      id: event.id,
      title: event.name,
      description: `소요 시간 ${event.durationHours}시간`,
      badge: displayTypeLabel(event.workflowType),
      tone: event.workflowType === "지연" ? "warning" : event.workflowType === "증가" ? "danger" : "info"
    })),
    activeDecisionItems: buildDecisionItems(data.proposals, data.decisions),
    primaryChart: {
      title: chartTitleForInsight(mainInsight?.id),
      description: chartDescriptionForInsight(mainInsight?.id),
      type: chartTypeForInsight(mainInsight?.id)
    }
  };
}

function buildDecisionItems(
  proposals: PrototypeState["proposals"],
  decisions: PrototypeState["decisions"]
): DashboardLinkedItem[] {
  const proposalItems = proposals.map<DashboardLinkedItem>((proposal) => ({
    id: proposal.id,
    title: proposal.title,
    description: proposal.summary,
    badge: proposal.status === "finalized" || proposal.status === "verified" ? "확정됨" : "투표 중",
    tone: proposal.status === "finalized" || proposal.status === "verified" ? "success" : "info",
    target: { screen: "proposalVote", focusId: proposal.id, label: `${proposal.title} 보기` }
  }));

  const decisionItems = decisions.map<DashboardLinkedItem>((decision) => ({
    id: decision.id,
    title: decision.title,
    description: decision.summary,
    badge: "확정",
    tone: "success",
    target: { screen: "proposalVote", focusId: decision.proposalId, label: `${decision.title} 투표 보기` }
  }));

  return [...proposalItems, ...decisionItems];
}

function buildChartPoints(metricName: string, metricValue?: PrototypeState["metricValues"][number]): DashboardChartPoint[] {
  if (!metricValue) {
    return [];
  }

  return metricValue.series?.length > 0
    ? metricValue.series.map((point) => ({ ...point, previousValue: metricValue.previousValue }))
    : [
        { label: "이전", value: metricValue.previousValue },
        { label: metricName, value: metricValue.value, previousValue: metricValue.previousValue }
      ];
}

function chartTypeForMetric(metricId: string): DashboardChartType {
  if (metricId.includes("claim")) {
    return "time_series";
  }

  if (metricId.includes("delay")) {
    return "line";
  }

  if (metricId.includes("margin")) {
    return "bar";
  }

  return "table";
}
