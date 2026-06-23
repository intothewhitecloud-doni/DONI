import {
  chartDescriptionForInsight,
  chartTitleForInsight,
  chartTypeForInsight,
  proposalIdForInsight,
  type DashboardChartType
} from "../../domain/result-scenarios";
import { displayTypeLabel } from "../../domain/type-catalog";
import type { LinkTarget, PrototypeState, SourceFile } from "../../domain/types";
import { currentCompanyData } from "../selectors";
import { getPhaseOneAnalysisProjection, type PhaseOneSignal } from "./phaseOneAnalysisProjection";

type SummaryTone = "success" | "warning" | "danger" | "info";
type DashboardTone = SummaryTone | "neutral";

type OrderClaimRecord = {
  id: string;
  orderedAt: string;
  customerGroup: string;
  productGroup: string;
  supplier: string;
  orderStatus: string;
  waitHours: number;
  claimType: string;
  claimStatus: string;
  region: string;
};

type ProductMarginRecord = {
  productGroup: string;
  productName: string;
  supplier: string;
  revenue: number;
  cost: number;
  discountRate: number;
  returnCost: number;
  averageMarginRate: number;
  deliveryComplianceRate: number;
};

export type DashboardSummaryCard = {
  label: string;
  value: string;
  detail: string;
  tone: SummaryTone;
  target?: LinkTarget;
};

export type DashboardChartPoint = {
  label: string;
  value: number;
  observedAt?: string;
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
  tone: DashboardTone;
  target: LinkTarget;
};

export type DashboardRecentFlowItem = {
  id: string;
  title: string;
  description: string;
  badge: string;
  tone: DashboardTone;
};

export type DashboardProductPerformanceRow = {
  id: string;
  productGroup: string;
  productName: string;
  supplier: string;
  revenueLabel: string;
  marginRateLabel: string;
  returnCostLabel: string;
  deliveryComplianceLabel: string;
  orderCountLabel: string;
  claimRateLabel: string;
  waitHoursLabel: string;
  statusLabel: string;
  tone: DashboardTone;
  target: LinkTarget;
};

export type DashboardSupplierHealthRow = {
  id: string;
  supplier: string;
  productsLabel: string;
  revenueLabel: string;
  marginRateLabel: string;
  deliveryComplianceLabel: string;
  waitHoursLabel: string;
  delayedOrdersLabel: string;
  riskLabel: string;
  tone: DashboardTone;
  target?: LinkTarget;
};

export type DashboardWorkflowSignal = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: DashboardTone;
  target?: LinkTarget;
};

export type DashboardSourceCoverageItem = {
  id: string;
  fileName: string;
  rowCountLabel: string;
  columnsLabel: string;
  summary: string;
  tone: DashboardTone;
};

export function getDashboardView(state: PrototypeState) {
  const data = currentCompanyData(state);
  const phaseOne = getPhaseOneAnalysisProjection(state);
  const decisions = uniqueById(data.decisions);
  const proposals = uniqueById(data.proposals);
  const warningMetricValues = data.metricValues.filter((value) => value.status !== "normal");
  const delayedEvents = data.events.filter((event) => ["지연", "증가", "검토"].includes(displayTypeLabel(event.workflowType)));
  const mainInsight = data.insights.find((insight) => insight.id === data.activeInsightId) ?? data.insights[0];
  const suggestedProposal = mainInsight
    ? proposals.find((proposal) => proposal.insightId === mainInsight.id) ?? {
        id: proposalIdForInsight(mainInsight.id),
        title: `${mainInsight.title} 대응 안건`,
        summary: "인사이트 상세에서 안건을 생성하면 투표 흐름으로 이어집니다.",
        insightId: mainInsight.id
      }
    : undefined;
  const orderRecords = parseOrderClaimRecords(data.sourceFiles);
  const marginRecords = parseProductMarginRecords(data.sourceFiles);

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
  const primaryChartType = chartTypeForInsight(mainInsight?.id);
  const primaryChartWidgets = selectPrimaryChartWidgets(metricWidgets, mainInsight?.relatedMetricIds ?? [], primaryChartType);

  return {
    phaseOne,
    summaryCards: buildSummaryCards(data, orderRecords, marginRecords, warningMetricValues, decisions.length || proposals.length, phaseOne.primarySignals),
    mainInsight,
    suggestedProposal,
    metricWidgets,
    primaryChartWidgets,
    productRows: buildProductRows(orderRecords, marginRecords),
    supplierRows: buildSupplierRows(data, orderRecords, marginRecords),
    workflowSignals: buildWorkflowSignals(orderRecords, data.events),
    sourceCoverage: buildSourceCoverageItems(data.sourceFiles, orderRecords, marginRecords),
    workflowListTarget: { screen: "workflow", label: "업무 흐름 목록 보기" } satisfies LinkTarget,
    recentFlows: data.events.map<DashboardRecentFlowItem>((event) => ({
      id: event.id,
      title: event.name,
      description: `소요 시간 ${formatOne(event.durationHours)}시간`,
      badge: displayTypeLabel(event.workflowType),
      tone: event.workflowType === "지연" ? "warning" : event.workflowType === "증가" ? "danger" : "info"
    })),
    activeDecisionItems: buildDecisionItems(proposals, decisions),
    primaryChart: {
      title: chartTitleForInsight(mainInsight?.id),
      description: chartDescriptionForInsight(mainInsight?.id),
      type: primaryChartType
    }
  };
}

function parseOrderClaimRecords(sourceFiles: SourceFile[]): OrderClaimRecord[] {
  const file = findSourceFile(sourceFiles, "주문_배송_클레임.xlsx", "주문");

  if (!file?.previewColumns || !file.previewRows) {
    return [];
  }

  return file.previewRows.map((row, index) => ({
    id: readCell(file, row, "주문번호", "주문ID") || `order-${index + 1}`,
    orderedAt: readCell(file, row, "주문일자") || "",
    customerGroup: readCell(file, row, "고객군") || "미분류 고객군",
    productGroup: readCell(file, row, "상품군") || "미분류 상품군",
    supplier: readCell(file, row, "공급사") || "미분류 공급사",
    orderStatus: readCell(file, row, "주문상태", "배송상태") || "상태 없음",
    waitHours: parseNumber(readCell(file, row, "출고대기시간")) ?? 0,
    claimType: readCell(file, row, "클레임유형") || "",
    claimStatus: readCell(file, row, "클레임상태") || "",
    region: readCell(file, row, "배송지역") || "지역 미상"
  }));
}

function parseProductMarginRecords(sourceFiles: SourceFile[]): ProductMarginRecord[] {
  const file = findSourceFile(sourceFiles, "상품별_마진_공급사.csv", "마진");

  if (!file?.previewColumns || !file.previewRows) {
    return [];
  }

  return file.previewRows.map((row) => ({
    productGroup: readCell(file, row, "상품군") || "미분류 상품군",
    productName: readCell(file, row, "상품명") || "미분류 상품",
    supplier: readCell(file, row, "공급사") || "미분류 공급사",
    revenue: parseNumber(readCell(file, row, "매출")) ?? 0,
    cost: parseNumber(readCell(file, row, "원가")) ?? 0,
    discountRate: parsePercent(readCell(file, row, "할인율")) ?? 0,
    returnCost: parseNumber(readCell(file, row, "반품비용")) ?? 0,
    averageMarginRate: parsePercent(readCell(file, row, "평균마진율")) ?? 0,
    deliveryComplianceRate: parsePercent(readCell(file, row, "납품준수율")) ?? 0
  }));
}

function findSourceFile(sourceFiles: SourceFile[], exactName: string, fallbackKeyword: string): SourceFile | undefined {
  return sourceFiles.find((file) => file.name === exactName) ?? sourceFiles.find((file) => file.name.includes(fallbackKeyword));
}

function readCell(file: SourceFile, row: string[], ...columnNames: string[]): string {
  const index = columnNames
    .map((columnName) => file.previewColumns?.indexOf(columnName) ?? -1)
    .find((columnIndex) => columnIndex >= 0);

  return index === undefined ? "" : row[index] ?? "";
}

function buildSummaryCards(
  data: ReturnType<typeof currentCompanyData>,
  orders: OrderClaimRecord[],
  margins: ProductMarginRecord[],
  warningMetricValues: PrototypeState["metricValues"],
  decisionCount: number,
  primarySignals: PhaseOneSignal[]
): DashboardSummaryCard[] {
  const p42Orders = orders.filter((order) => order.productGroup === "P-42");
  const p42Margins = margins.filter((row) => row.productGroup === "P-42");
  const supplierARows = margins.filter((row) => row.supplier.includes("A사"));
  const p42ReturnCost = sum(p42Margins.map((row) => row.returnCost));
  const strongRelations = data.relations.filter((relation) => relation.strength === "strong" || relation.status.includes("강한"));
  const signalById = new Map(primarySignals.map((signal) => [signal.id, signal]));

  if (orders.length === 0 && margins.length === 0) {
    return [
      { label: "관리 대상", value: `${data.entities.length}개`, detail: "현재 기준 데이터", tone: "success" },
      {
        label: "주의 지표",
        value: `${warningMetricValues.length}개`,
        detail: "정상 외 지표",
        tone: warningMetricValues.some((metric) => metric.status === "critical") ? "danger" : "warning"
      },
      {
        label: "업무 흐름",
        value: `${data.events.length}건`,
        detail: "지연/증가 흐름 포함",
        tone: data.events.some((event) => event.workflowType === "지연" || event.workflowType === "증가") ? "warning" : "info"
      },
      { label: "의사결정", value: `${decisionCount}건`, detail: "진행/확정 안건", tone: decisionCount > 0 ? "success" : "info" }
    ];
  }

  return [
    summaryCardFromSignal(signalById.get("p42-delay-rate"), "P-42 지연률"),
    summaryCardFromSignal(signalById.get("p42-claim-rate"), "P-42 클레임률"),
    summaryCardFromSignal(signalById.get("p42-margin"), "평균 마진율"),
    summaryCardFromSignal(signalById.get("supplier-a-compliance"), "A사 납품준수", `P-42·P-08 공급 ${supplierARows.length}행 평균`),
    {
      label: "P-42 반품비용",
      value: formatCurrencyManwon(p42ReturnCost),
      detail: "상품별 마진 파일 합계",
      tone: "warning",
      target: { screen: "metrics", focusId: "metric-margin", label: "평균 마진율 보기" }
    },
    {
      label: "강한 연결",
      value: `${strongRelations.length}개`,
      detail: `전체 관계 ${data.relations.length}개 중 우선 추적`,
      tone: strongRelations.length > 0 ? "info" : "success",
      target: { screen: "objects", focusId: "entity-low-margin", label: "P-42 관리 대상 보기" }
    }
  ];
}

function summaryCardFromSignal(signal: PhaseOneSignal | undefined, label: string, detail?: string): DashboardSummaryCard {
  return {
    label,
    value: signal?.value ?? "-",
    detail: detail ?? signal?.detail ?? "Phase 1 projection 기준",
    tone: signalToneToSummaryTone(signal?.tone),
    target: signal?.target
  };
}

function signalToneToSummaryTone(tone?: PhaseOneSignal["tone"]): SummaryTone {
  if (tone === "danger" || tone === "warning" || tone === "success" || tone === "info") {
    return tone;
  }

  return "info";
}

function buildProductRows(orders: OrderClaimRecord[], margins: ProductMarginRecord[]): DashboardProductPerformanceRow[] {
  const orderGroups = groupBy(orders, (order) => order.productGroup);

  return Object.entries(groupBy(margins, (row) => row.productGroup))
    .map(([productGroup, rows]) => {
      const productOrders = orderGroups[productGroup] ?? [];
      const claims = productOrders.filter(hasClaim);
      const delayed = productOrders.filter(isDelayedOrder);
      const marginRate = average(rows.map((row) => row.averageMarginRate));
      const complianceRate = average(rows.map((row) => row.deliveryComplianceRate));
      const claimRate = rate(claims.length, productOrders.length);
      const waitHours = average(productOrders.map((order) => order.waitHours));
      const tone = productTone(marginRate, complianceRate, claimRate, delayed.length);

      return {
        id: `product:${productGroup}`,
        productGroup,
        productName: rows[0]?.productName ?? productGroup,
        supplier: compactJoin(unique(rows.map((row) => row.supplier)), " · "),
        revenueLabel: formatEok(sum(rows.map((row) => row.revenue))),
        marginRateLabel: formatPercent(marginRate),
        returnCostLabel: formatCurrencyManwon(sum(rows.map((row) => row.returnCost))),
        deliveryComplianceLabel: formatPercent(complianceRate),
        orderCountLabel: productOrders.length > 0 ? `${productOrders.length}건` : "-",
        claimRateLabel: productOrders.length > 0 ? formatPercent(claimRate) : "-",
        waitHoursLabel: waitHours === undefined ? "-" : `${formatOne(waitHours)}시간`,
        statusLabel: productStatusLabel(tone),
        tone,
        target: { screen: "metrics", focusId: "metric-margin", label: `${productGroup} 마진 보기` }
      } satisfies DashboardProductPerformanceRow;
    })
    .sort(compareProductRows);
}

function buildSupplierRows(
  data: ReturnType<typeof currentCompanyData>,
  orders: OrderClaimRecord[],
  margins: ProductMarginRecord[]
): DashboardSupplierHealthRow[] {
  const orderGroups = groupBy(orders, (order) => order.supplier);

  return Object.entries(groupBy(margins, (row) => row.supplier))
    .map(([supplier, rows]) => {
      const supplierOrders = orderGroups[supplier] ?? [];
      const delayedOrders = supplierOrders.filter(isDelayedOrder);
      const claimOrders = supplierOrders.filter(hasClaim);
      const marginRate = average(rows.map((row) => row.averageMarginRate));
      const complianceRate = average(rows.map((row) => row.deliveryComplianceRate));
      const waitHours = average(supplierOrders.map((order) => order.waitHours));
      const delayedRate = rate(delayedOrders.length, supplierOrders.length);
      const claimRate = rate(claimOrders.length, supplierOrders.length);
      const tone = supplierTone(complianceRate, delayedRate, claimRate);
      const linkedEntity = data.entities.find((entity) => entity.name === supplier);

      return {
        id: `supplier:${supplier}`,
        supplier,
        productsLabel: compactJoin(unique(rows.map((row) => row.productGroup)), " · "),
        revenueLabel: formatEok(sum(rows.map((row) => row.revenue))),
        marginRateLabel: formatPercent(marginRate),
        deliveryComplianceLabel: formatPercent(complianceRate),
        waitHoursLabel: waitHours === undefined ? "주문 없음" : `${formatOne(waitHours)}시간 평균`,
        delayedOrdersLabel: supplierOrders.length > 0 ? `${delayedOrders.length}/${supplierOrders.length}건 지연` : "주문 없음",
        riskLabel: supplierRiskLabel(tone),
        tone,
        target: linkedEntity ? { screen: "objects", focusId: linkedEntity.id, label: `${supplier} 보기` } : undefined
      } satisfies DashboardSupplierHealthRow;
    })
    .sort(compareSupplierRows);
}

function buildWorkflowSignals(orders: OrderClaimRecord[], fallbackEvents: PrototypeState["events"]): DashboardWorkflowSignal[] {
  if (orders.length === 0) {
    return fallbackEvents.slice(0, 6).map((event) => ({
      id: event.id,
      label: event.name,
      value: `${formatOne(event.durationHours)}시간`,
      detail: displayTypeLabel(event.workflowType),
      tone: event.workflowType === "지연" ? "warning" : event.workflowType === "증가" ? "danger" : "info",
      target: { screen: "workflow", focusId: event.id, label: `${event.name} 보기` }
    }));
  }

  const p42Orders = orders.filter((order) => order.productGroup === "P-42");
  const delayedOrders = orders.filter(isDelayedOrder);
  const claimOrders = orders.filter(hasClaim);
  const deliveryDelayClaims = claimOrders.filter((order) => order.claimType.includes("배송"));
  const qualityClaims = claimOrders.filter((order) => order.claimType.includes("품질"));
  const coreCustomerOrders = orders.filter((order) => order.customerGroup.includes("핵심"));
  const topRegion = topCount(orders.map((order) => order.region));
  const firstDate = orders[0]?.orderedAt ?? "";
  const lastDate = orders.at(-1)?.orderedAt ?? "";

  return [
    {
      id: "orders-total",
      label: "전체 주문",
      value: `${orders.length}건`,
      detail: firstDate && lastDate ? `${firstDate}~${lastDate}` : "주문 파일 기준",
      tone: "info"
    },
    {
      id: "orders-delayed",
      label: "출고 지연",
      value: `${delayedOrders.length}건`,
      detail: `P-42 지연률 ${formatPercent(rate(p42Orders.filter(isDelayedOrder).length, p42Orders.length))}`,
      tone: "danger",
      target: { screen: "workflow", focusId: "event-outbound", label: "출고 처리 보기" }
    },
    {
      id: "orders-claims",
      label: "클레임 기록",
      value: `${claimOrders.length}건`,
      detail: `배송 ${deliveryDelayClaims.length}건 · 품질 ${qualityClaims.length}건`,
      tone: "danger",
      target: { screen: "workflow", focusId: "event-claim", label: "클레임 접수 보기" }
    },
    {
      id: "orders-wait",
      label: "평균 대기",
      value: `${formatOne(average(orders.map((order) => order.waitHours)) ?? 0)}시간`,
      detail: `P-42 ${formatOne(average(p42Orders.map((order) => order.waitHours)) ?? 0)}시간`,
      tone: "warning",
      target: { screen: "metrics", focusId: "metric-delay-time", label: "평균 출고 대기시간 보기" }
    },
    {
      id: "orders-customer",
      label: "핵심 고객군",
      value: `${coreCustomerOrders.length}건`,
      detail: `클레임 ${coreCustomerOrders.filter(hasClaim).length}건 집중`,
      tone: "warning",
      target: { screen: "objects", focusId: "entity-customer-core", label: "핵심 고객군 관리 대상 보기" }
    },
    {
      id: "orders-region",
      label: "최다 지역",
      value: topRegion?.label ?? "-",
      detail: topRegion ? `${topRegion.count}건 주문` : "지역 데이터 없음",
      tone: "neutral"
    }
  ];
}

function buildSourceCoverageItems(
  sourceFiles: SourceFile[],
  orders: OrderClaimRecord[],
  margins: ProductMarginRecord[]
): DashboardSourceCoverageItem[] {
  const sourceItems: Array<{ source?: SourceFile; summary: string; tone: DashboardTone }> = [
    {
      source: findSourceFile(sourceFiles, "주문_배송_클레임.xlsx", "주문"),
      summary: `${orders.length}건 주문 · ${orders.filter(hasClaim).length}건 클레임 · ${orders.filter(isDelayedOrder).length}건 지연`,
      tone: "danger"
    },
    {
      source: findSourceFile(sourceFiles, "상품별_마진_공급사.csv", "마진"),
      summary: `${margins.length}개 상품 행 · ${unique(margins.map((row) => row.supplier)).length}개 공급사 · P-42 반품 ${formatCurrencyManwon(sum(margins.filter((row) => row.productGroup === "P-42").map((row) => row.returnCost)))}`,
      tone: "warning"
    }
  ];

  return sourceItems
    .filter((item): item is { source: SourceFile; summary: string; tone: DashboardTone } => Boolean(item.source))
    .map(({ source, summary, tone }) => ({
      id: source.id,
      fileName: source.name,
      rowCountLabel: `${source.rowCount}행`,
      columnsLabel: `${source.previewColumns?.length ?? 0}개 컬럼`,
      summary,
      tone
    }));
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seenIds = new Set<string>();

  return items.filter((item) => {
    if (seenIds.has(item.id)) {
      return false;
    }

    seenIds.add(item.id);
    return true;
  });
}

function selectPrimaryChartWidgets(
  widgets: DashboardMetricWidget[],
  relatedMetricIds: string[],
  chartType: DashboardChartType
): DashboardMetricWidget[] {
  const relatedWidgets = relatedMetricIds.length > 0
    ? widgets.filter((widget) => relatedMetricIds.includes(widget.id))
    : widgets;
  const typeMatchedWidgets = relatedWidgets.filter((widget) => widget.chartType === chartType);

  if (typeMatchedWidgets.length > 0) {
    return typeMatchedWidgets;
  }

  if (relatedWidgets.length > 0) {
    return relatedWidgets;
  }

  return widgets;
}

function buildDecisionItems(
  proposals: PrototypeState["proposals"],
  decisions: PrototypeState["decisions"]
): DashboardLinkedItem[] {
  const decisionIds = new Set(decisions.map((decision) => decision.id));
  const resolvedProposalRefs = new Set(decisions.flatMap((decision) => [decision.proposalId, decision.id]));
  const proposalItems = proposals
    .filter((proposal) => !resolvedProposalRefs.has(proposal.id) && (!proposal.decisionId || !decisionIds.has(proposal.decisionId)))
    .map<DashboardLinkedItem>((proposal) => ({
      id: `proposal:${proposal.id}`,
      title: proposal.title,
      description: proposal.summary,
      badge: proposal.status === "finalized" || proposal.status === "verified" ? "확정됨" : "투표 중",
      tone: proposal.status === "finalized" || proposal.status === "verified" ? "success" : "info",
      target: { screen: "proposalVote", focusId: proposal.id, label: `${proposal.title} 보기` }
    }));

  const decisionItems = decisions.map<DashboardLinkedItem>((decision) => ({
    id: `decision:${decision.id}`,
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

function isDelayedOrder(order: OrderClaimRecord): boolean {
  return order.orderStatus.includes("지연");
}

function hasClaim(order: OrderClaimRecord): boolean {
  return Boolean(order.claimType.trim()) || (Boolean(order.claimStatus.trim()) && order.claimStatus !== "없음");
}

function productTone(
  marginRate: number | undefined,
  complianceRate: number | undefined,
  claimRate: number | undefined,
  delayedCount: number
): DashboardTone {
  if ((marginRate !== undefined && marginRate < 15) || (claimRate !== undefined && claimRate >= 80)) {
    return "danger";
  }

  if ((complianceRate !== undefined && complianceRate < 82) || delayedCount > 0 || (claimRate !== undefined && claimRate > 0)) {
    return "warning";
  }

  return "success";
}

function supplierTone(
  complianceRate: number | undefined,
  delayedRate: number | undefined,
  claimRate: number | undefined
): DashboardTone {
  if ((complianceRate !== undefined && complianceRate < 80) || (delayedRate !== undefined && delayedRate >= 50)) {
    return "danger";
  }

  if ((complianceRate !== undefined && complianceRate < 90) || (claimRate !== undefined && claimRate > 0)) {
    return "warning";
  }

  return "success";
}

function productStatusLabel(tone: DashboardTone): string {
  if (tone === "danger") {
    return "우선 조치";
  }

  if (tone === "warning") {
    return "관찰";
  }

  return "정상";
}

function supplierRiskLabel(tone: DashboardTone): string {
  if (tone === "danger") {
    return "조건 재협의";
  }

  if (tone === "warning") {
    return "주의 관찰";
  }

  return "정상 공급";
}

function compareProductRows(left: DashboardProductPerformanceRow, right: DashboardProductPerformanceRow): number {
  const toneOrder: Record<DashboardTone, number> = { danger: 0, warning: 1, info: 2, neutral: 3, success: 4 };
  const toneDiff = toneOrder[left.tone] - toneOrder[right.tone];

  if (toneDiff !== 0) {
    return toneDiff;
  }

  return right.revenueLabel.localeCompare(left.revenueLabel);
}

function compareSupplierRows(left: DashboardSupplierHealthRow, right: DashboardSupplierHealthRow): number {
  const toneOrder: Record<DashboardTone, number> = { danger: 0, warning: 1, info: 2, neutral: 3, success: 4 };
  const toneDiff = toneOrder[left.tone] - toneOrder[right.tone];

  if (toneDiff !== 0) {
    return toneDiff;
  }

  return left.supplier.localeCompare(right.supplier);
}

function groupBy<T>(items: T[], keyForItem: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = keyForItem(item);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function compactJoin(items: string[], separator: string): string {
  return items.length > 0 ? items.join(separator) : "-";
}

function average(values: number[]): number | undefined {
  const validValues = values.filter((value) => Number.isFinite(value));

  if (validValues.length === 0) {
    return undefined;
  }

  return sum(validValues) / validValues.length;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function rate(numerator: number, denominator: number): number | undefined {
  if (denominator <= 0) {
    return undefined;
  }

  return (numerator / denominator) * 100;
}

function topCount(values: string[]): { label: string; count: number } | undefined {
  const counts = values.reduce<Record<string, number>>((result, value) => {
    if (!value) {
      return result;
    }

    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
  const [label, count] = Object.entries(counts).sort((left, right) => right[1] - left[1])[0] ?? [];

  return label ? { label, count } : undefined;
}

function parseNumber(value: string): number | undefined {
  const normalized = value.replace(/,/g, "").replace(/시간/g, "").trim();
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePercent(value: string): number | undefined {
  return parseNumber(value.replace("%", ""));
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) {
    return "-";
  }

  return `${formatOne(value)}%`;
}

function formatCurrencyManwon(value: number): string {
  if (value <= 0) {
    return "-";
  }

  return `${Math.round(value / 10000).toLocaleString("ko-KR")}만원`;
}

function formatEok(value: number): string {
  if (value <= 0) {
    return "-";
  }

  return `${formatOne(value / 100000000)}억`;
}

function formatOne(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
