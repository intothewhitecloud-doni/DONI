import type { AiChatAction, AiChatVisualBlock, AiChatVisualTone } from "./aiChatTypes";
import { initialPrototypeState } from "../../lib/domain/mock-data";
import type { EvidenceReference, MetricDefinition, MetricValue, PrototypeState } from "../../lib/domain/types";

export type AiCanvasMetricSummary = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: AiChatVisualTone;
};

export type AiCanvasRecommendation = {
  id: string;
  title: string;
  description: string;
  impact: string;
  tone: AiChatVisualTone;
  action?: AiChatAction;
};

export type AiCanvasDetailTable = {
  title: string;
  caption: string;
  columns: string[];
  rows: Array<{
    id: string;
    cells: string[];
    tone?: AiChatVisualTone;
  }>;
};

export type AiCanvasScenario = {
  id: string;
  prompt: string;
  shortLabel: string;
  title: string;
  subtitle: string;
  summary: string[];
  confidence: number;
  confidenceLabel: string;
  metricSummaries: AiCanvasMetricSummary[];
  visualBlocks: AiChatVisualBlock[];
  evidence: EvidenceReference[];
  keyFindings: string[];
  detailTable: AiCanvasDetailTable;
  recommendations: AiCanvasRecommendation[];
  actionItems: AiChatAction[];
  sampleDataLabel: string;
};

export type AiCanvasOverview = {
  title: string;
  subtitle: string;
  summary: string[];
  confidence: number;
  confidenceLabel: string;
  visualBlocks: AiChatVisualBlock[];
  evidence: EvidenceReference[];
  keyFindings: string[];
  detailTable: AiCanvasDetailTable;
  recommendations: AiCanvasRecommendation[];
  sampleDataLabel: string;
};

export type AiCanvasFallbackGuide = {
  content: string;
  prompts: Array<{
    id: string;
    label: string;
    prompt: string;
  }>;
};

const fixedScenarioIds = ["supplier-a-impact", "highest-risk-signal", "p42-margin-cause", "customer-a-claims"] as const;

type FixedScenarioId = (typeof fixedScenarioIds)[number];

type CanvasStateResolution = {
  sampleDataLabel: string;
  state: PrototypeState;
};

const fixedCanvasScenarioMeta: Record<FixedScenarioId, { prompt: string; shortLabel: string }> = {
  "customer-a-claims": {
    prompt: "핵심 고객군 클레임 원인은?",
    shortLabel: "핵심 고객군 클레임"
  },
  "highest-risk-signal": {
    prompt: "현재 가장 위험한 운영 신호는?",
    shortLabel: "위험 신호"
  },
  "p42-margin-cause": {
    prompt: "P-42 마진이 왜 낮아졌어?",
    shortLabel: "P-42 마진"
  },
  "supplier-a-impact": {
    prompt: "공급업체 A사가 어떤 영향을 줘?",
    shortLabel: "공급업체 A사"
  }
};

const fixedCanvasPromptAliases: Record<FixedScenarioId, string[]> = {
  "customer-a-claims": ["핵심 고객군 클레임 원인", "핵심 고객군 보상 요청", "고객A 클레임 원인", "고객 A 클레임 원인", "고객A 보상 요청", "고객A 클레임 분석"],
  "highest-risk-signal": ["가장 위험한 신호", "위험 신호 알려줘", "위험한 운영 신호", "우선순위 분석"],
  "p42-margin-cause": ["P42 마진 원인", "P-42 마진 원인", "P42 마진 낮아진 이유", "P-42 수익성"],
  "supplier-a-impact": ["공급업체 A 영향 알려줘", "공급업체 A사 영향", "A사 영향", "A사 공급 리스크"]
};

export function getFixedAiCanvasScenarios(state: PrototypeState): AiCanvasScenario[] {
  const canvasState = resolveCanvasState(state);
  return fixedScenarioIds.map((scenarioId) => buildCanvasScenario(canvasState.state, scenarioId, canvasState.sampleDataLabel));
}

export function findAiCanvasPromptScenario(question: string, state: PrototypeState): AiCanvasScenario | undefined {
  const normalizedQuestion = normalizePrompt(question);
  if (!normalizedQuestion) {
    return undefined;
  }

  return getFixedAiCanvasScenarios(state).find((scenario) => {
    const scenarioId = scenario.id as FixedScenarioId;
    return [scenario.prompt, scenario.shortLabel, ...fixedCanvasPromptAliases[scenarioId]].some((candidate) => {
      const normalizedCandidate = normalizePrompt(candidate);
      return normalizedQuestion === normalizedCandidate;
    });
  });
}

export function getAiCanvasFallbackGuide(state: PrototypeState): AiCanvasFallbackGuide {
  return {
    content: "현재 데이터에서 우선 확인할 수 있는 질문입니다. 질문 배지를 선택하면 입력창에 채워지고, 전송하면 차트, 근거, 연결 정보를 포함한 canvas 답변을 확인할 수 있습니다.",
    prompts: getFixedAiCanvasScenarios(state).map((scenario) => ({
      id: scenario.id,
      label: scenario.shortLabel,
      prompt: scenario.prompt
    }))
  };
}

export function getAiCanvasOverview(state: PrototypeState): AiCanvasOverview {
  const scenarios = getFixedAiCanvasScenarios(state);
  const supplier = scenarioById(scenarios, "supplier-a-impact");
  const risk = scenarioById(scenarios, "highest-risk-signal");
  const margin = scenarioById(scenarios, "p42-margin-cause");
  const claims = scenarioById(scenarios, "customer-a-claims");
  const confidence = scenarios.reduce((sum, scenario) => sum + scenario.confidence, 0) / Math.max(scenarios.length, 1);

  return {
    title: "현재 데이터 기준 전반 분석 제안",
    subtitle: "P-42, 핵심 고객군, 공급업체 A사의 연결된 운영 신호를 먼저 확인하는 흐름입니다.",
    summary: [
      "현재 데이터에서는 P-42 수익성 하락, 핵심 고객군 클레임 반복, 공급업체 A사 지연이 하나의 운영 리스크 묶음으로 연결됩니다.",
      "첫 검토는 전체 위험 우선순위를 확인한 뒤, 공급 지연과 마진 하락, 고객 영향으로 원인을 분리하는 순서가 적절합니다.",
      "아래 4개 질문은 같은 데이터를 서로 다른 관점으로 보여주며, 답변마다 차트와 근거 위치, 연결 정보를 함께 제공합니다."
    ],
    confidence,
    confidenceLabel: "4개 분석 시나리오 교차 요약",
    visualBlocks: [
      risk?.visualBlocks[0],
      supplier?.visualBlocks[0],
      margin?.visualBlocks[0],
      claims?.visualBlocks[0]
    ].filter((block): block is AiChatVisualBlock => Boolean(block)),
    evidence: uniqueEvidence(scenarios.flatMap((scenario) => scenario.evidence)),
    keyFindings: [
      risk?.keyFindings[0],
      supplier?.keyFindings[0],
      margin?.keyFindings[0],
      claims?.keyFindings[0]
    ].filter((item): item is string => Boolean(item)),
    detailTable: {
      title: "분석 관점별 우선 확인",
      caption: "첫 화면은 특정 배지 선택 결과가 아니라 전체 데이터의 분석 출발점을 보여줍니다.",
      columns: ["관점", "핵심 질문", "우선 확인", "기대 출력"],
      rows: scenarios.map((scenario, index) => ({
        id: `overview-${scenario.id}`,
        cells: [String(index + 1), scenario.prompt, scenario.title, "설명 · 차트 · 근거 · 추천 시나리오"],
        tone: index === 0 ? "info" : index === 1 ? "danger" : "warning"
      }))
    },
    recommendations: [
      recommendation("overview-risk", "위험 신호 우선순위 확인", "마진, 클레임, 출고 대기시간을 같은 우선순위 표로 먼저 정렬합니다.", "분석 순서 명확화", "danger"),
      recommendation("overview-supplier", "공급 지연 원인 분리", "A사 납품 준수율과 출고 대기시간을 먼저 확인합니다.", "병목 원인 분리", "warning"),
      recommendation("overview-customer", "고객 영향 대응안 정리", "핵심 고객군 클레임과 보상 기준을 함께 검토합니다.", "이탈 위험 완화", "info")
    ],
    sampleDataLabel: scenarios[0]?.sampleDataLabel ?? "기본 데이터"
  };
}

export function getAiCanvasScenario(state: PrototypeState, scenarioId: string): AiCanvasScenario | undefined {
  const canvasState = resolveCanvasState(state);
  if (!fixedScenarioIds.includes(scenarioId as FixedScenarioId)) {
    return undefined;
  }

  return buildCanvasScenario(canvasState.state, scenarioId as FixedScenarioId, canvasState.sampleDataLabel);
}

function normalizePrompt(value: string): string {
  return value.trim().toLowerCase().replace(/[\s?!.,·~_-]+/g, "");
}

function scenarioById(scenarios: AiCanvasScenario[], scenarioId: FixedScenarioId): AiCanvasScenario | undefined {
  return scenarios.find((scenario) => scenario.id === scenarioId);
}

function uniqueEvidence(evidence: EvidenceReference[]): EvidenceReference[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function stateHasCanvasData(state: PrototypeState): boolean {
  return state.metricDefinitions.length > 0 && state.metricValues.length > 0 && state.evidence.length > 0;
}

function resolveCanvasState(state: PrototypeState): CanvasStateResolution {
  if (stateHasCanvasData(state)) {
    return { sampleDataLabel: "현재 데이터", state };
  }

  return { sampleDataLabel: "기본 데이터", state: initialPrototypeState };
}

function buildCanvasScenario(state: PrototypeState, scenarioId: FixedScenarioId, sampleDataLabel: string): AiCanvasScenario {
  const scenario = fixedCanvasScenarioMeta[scenarioId];
  const evidence = evidenceFor(state, evidenceIdsForScenario(scenarioId));

  switch (scenarioId) {
    case "highest-risk-signal":
      return {
        id: scenarioId,
        prompt: scenario.prompt,
        shortLabel: scenario.shortLabel,
        title: "상위 위험 신호 집중 분석",
        subtitle: "P-42 마진, 핵심 고객군 클레임, 공급업체 A사 지연을 같은 우선순위 표로 정리합니다.",
        summary: [
          "현재 데이터 기준 가장 큰 신호는 P-42에 집중된 수익성 하락과 고객 영향입니다.",
          `${metricLine(state, "metric-margin")} ${metricLine(state, "metric-delay-time")} ${metricLine(state, "metric-claim-rate")}`,
          "세 지표가 같은 상품군과 고객 흐름에 겹쳐 있고, 인사이트도 P-42 마진 하락과 핵심 고객군 클레임 반복을 높은 영향으로 보고 있습니다."
        ],
        confidence: confidenceFromEvidence(evidence, 0.92),
        confidenceLabel: "근거 3종 교차 확인",
        metricSummaries: metricSummariesFor(state, ["metric-margin", "metric-claim-rate", "metric-delay-time"]),
        visualBlocks: [
          ...metricBlocksFor(state, [
            ["metric-margin", "visual-canvas-risk-margin", "P-42 마진율"],
            ["metric-claim-rate", "visual-canvas-risk-claims", "핵심 고객군 클레임률"],
            ["metric-delay-time", "visual-canvas-risk-delay", "평균 출고 대기시간"]
          ]),
          comparisonVisualBlock("visual-highest-risk-priority", "위험 신호 우선순위", [
            { label: "1순위", value: "P-42 마진 구조", detail: metricDeltaDetail(state, "metric-margin"), tone: "danger" },
            { label: "2순위", value: "핵심 고객군 클레임", detail: metricDeltaDetail(state, "metric-claim-rate"), tone: "danger" },
            { label: "3순위", value: "공급업체 A사 지연", detail: metricDeltaDetail(state, "metric-delay-time"), tone: "warning" }
          ], "지표 악화 폭과 고객 영향도를 함께 본 해석형 정렬입니다.")
        ],
        evidence,
        keyFindings: [
          "마진 하락, 클레임 반복, 공급 지연이 P-42와 고객 흐름에 겹쳐 있습니다.",
          "고객 영향이 즉시 발생하는 클레임과 공급 조건 재협의가 같은 대응 묶음에 있습니다.",
          "인사이트 상세, 지표 화면, 관리 대상 화면으로 이어지는 기존 검토 동선이 유효합니다."
        ],
        detailTable: riskPriorityTable(state),
        recommendations: [
          recommendation("risk-margin", "P-42 마진 구조 먼저 점검", "할인율과 반품비용을 함께 보고 수익성 압박을 분리합니다.", "+8%p 개선 여지", "danger", metricAction("마진 지표 보기", "metric-margin")),
          recommendation("risk-customer", "핵심 고객군 선제 안내", "배송 지연과 보상 요청을 먼저 정리해 이탈 위험을 낮춥니다.", "클레임 재발 감소", "warning", insightAction("핵심 고객군 인사이트 보기", "insight-customer-claims")),
          recommendation("risk-supplier", "공급업체 A사 조건 재협의", "납품 준수율과 출고 대기시간을 기준으로 개선 조건을 협의합니다.", "처리 시간 단축", "info", objectAction("공급업체 A사 보기", "entity-supplier-a"))
        ],
        actionItems: [
          insightAction("P-42 인사이트 보기", "insight-product-margin"),
          metricAction("평균 마진율 보기", "metric-margin"),
          metricAction("클레임률 보기", "metric-claim-rate")
        ],
        sampleDataLabel
      };
    case "p42-margin-cause":
      return {
        id: scenarioId,
        prompt: scenario.prompt,
        shortLabel: scenario.shortLabel,
        title: "P-42 마진 하락 원인 canvas",
        subtitle: "할인, 반품비용, 공급 지연을 한 화면에서 비교해 상품군 단위 원인을 분리합니다.",
        summary: [
          `P-42 평균 마진율은 ${formatMetric(state, "metric-margin")}로 이전 기준보다 낮습니다.`,
          `분석 근거는 할인율 ${discountRange(state)}, 반품비용 ${formatCurrencyManwon(metricValue(state, "metric-margin")?.basis?.returnCost)}, 공급 지연으로 인한 비용 압박을 함께 보고 있습니다.`,
          "따라서 단순 가격 문제가 아니라 할인, 반품, 공급 지연이 겹친 상품군 단위 이슈로 보는 편이 맞습니다."
        ],
        confidence: confidenceFromEvidence(evidence, 0.9),
        confidenceLabel: "마진·공급 근거 확인",
        metricSummaries: metricSummariesFor(state, ["metric-margin", "metric-delay-time"]),
        visualBlocks: [
          metricVisualBlock(state, "metric-margin", {
            description: "상품군별 평균 마진율 비교입니다.",
            id: "visual-p42-margin-comparison",
            title: "P-42 마진 비교"
          }),
          comparisonVisualBlock("visual-p42-margin-factors", "마진 하락 요인", [
            { label: "할인율", value: discountRange(state), detail: "P-42 주문군에 적용된 할인 구간", tone: "warning" },
            { label: "반품비용", value: formatCurrencyManwon(metricValue(state, "metric-margin")?.basis?.returnCost), detail: "마진을 직접 압박하는 비용 요인", tone: "danger" },
            { label: "공급 지연", value: formatMetric(state, "metric-delay-time"), detail: "출고 지연으로 긴급 대응 비용 가능성 증가", tone: "warning" }
          ]),
          ...metricBlocksFor(state, [
            ["metric-delay-time", "visual-canvas-margin-delay-time", "평균 출고 대기시간"],
            ["metric-claim-rate", "visual-canvas-margin-claim-rate", "고객 영향 클레임률"]
          ])
        ],
        evidence,
        keyFindings: [
          "P-42 평균 마진율은 이전 기준보다 낮아졌고 위험 상태로 분류됩니다.",
          "반품비용과 할인율이 직접 비용 압박으로 연결됩니다.",
          "공급업체 A사 지연은 긴급 대응 비용 가능성을 키웁니다."
        ],
        detailTable: marginFactorsTable(state),
        recommendations: [
          recommendation("margin-discount", "할인율 구간 재검토", "P-42 주문군 할인 조건을 고객군별로 분리합니다.", "+5%p 마진 방어", "warning", metricAction("평균 마진율 보기", "metric-margin")),
          recommendation("margin-return", "반품비용 원인 추적", "반품비용 항목을 클레임 원인과 같이 검토합니다.", "비용 압박 완화", "danger", insightAction("마진 인사이트 보기", "insight-product-margin")),
          recommendation("margin-supply", "공급 지연 대응 병행", "A사 납품 준수율과 P-42 납기 흐름을 함께 추적합니다.", "긴급 비용 감소", "info", objectAction("P-42 관리 대상 보기", "entity-low-margin"))
        ],
        actionItems: [
          metricAction("평균 마진율 보기", "metric-margin"),
          insightAction("마진 인사이트 보기", "insight-product-margin"),
          objectAction("P-42 관리 대상 보기", "entity-low-margin")
        ],
        sampleDataLabel
      };
    case "customer-a-claims":
      return {
        id: scenarioId,
        prompt: scenario.prompt,
        shortLabel: scenario.shortLabel,
        title: "핵심 고객군 클레임 원인 분석",
        subtitle: "배송 지연, 보상 요청, 반복 구매 고객군 영향을 클레임 추세와 함께 확인합니다.",
        summary: [
          "핵심 고객군 클레임은 P-42 배송 지연 이후 반복된 보상 요청과 연결됩니다.",
          `현재 클레임률은 ${formatMetric(state, "metric-claim-rate")}이고 평균 출고 대기시간도 ${formatMetric(state, "metric-delay-time")}까지 늘어난 상태입니다.`,
          "우선 핵심 고객군에는 선제 안내를 발송하고, 보상 기준을 고객군 영향도에 맞춰 조정하는 답변이 인사이트의 추천 조치와 맞습니다."
        ],
        confidence: confidenceFromEvidence(evidence, 0.88),
        confidenceLabel: "주문·클레임 근거 확인",
        metricSummaries: metricSummariesFor(state, ["metric-claim-rate", "metric-delay-time"]),
        visualBlocks: [
          metricVisualBlock(state, "metric-claim-rate", {
            description: "핵심 고객군 관련 클레임률이 기간별로 누적 상승한 흐름입니다.",
            id: "visual-customer-a-claim-trend",
            title: "핵심 고객군 클레임 추세"
          }),
          comparisonVisualBlock("visual-customer-a-impact", "핵심 고객군 영향 요약", [
            { label: "클레임률", value: formatMetric(state, "metric-claim-rate"), detail: metricDeltaDetail(state, "metric-claim-rate"), tone: "danger" },
            { label: "평균 출고 대기시간", value: formatMetric(state, "metric-delay-time"), detail: metricDeltaDetail(state, "metric-delay-time"), tone: "warning" }
          ]),
          ...metricBlocksFor(state, [
            ["metric-delay-time", "visual-canvas-claims-delay-time", "평균 출고 대기시간"],
            ["metric-margin", "visual-canvas-claims-margin", "P-42 평균 마진"]
          ])
        ],
        evidence,
        keyFindings: [
          "핵심 고객군 클레임은 P-42 배송 지연 이후 반복 보상 요청과 연결됩니다.",
          "클레임률과 평균 출고 대기시간이 동시에 악화되어 고객 영향이 커졌습니다.",
          "선제 안내와 보상 기준 조정은 인사이트의 추천 조치와 맞습니다."
        ],
        detailTable: customerClaimsTable(state),
        recommendations: [
          recommendation("claim-notice", "핵심 고객군 선제 안내", "지연 사유와 보상 기준을 먼저 안내합니다.", "이탈 위험 완화", "danger", insightAction("핵심 고객군 인사이트 보기", "insight-customer-claims")),
          recommendation("claim-policy", "보상 기준 조정", "반복 구매 고객군 영향도에 맞춘 보상 기준을 정리합니다.", "대응 비용 통제", "warning", metricAction("클레임률 보기", "metric-claim-rate")),
          recommendation("claim-monitor", "2주 클레임 추세 모니터링", "클레임률과 출고 대기시간을 같은 기간으로 추적합니다.", "재발 신호 조기 탐지", "info", objectAction("핵심 고객군 관리 대상 보기", "entity-customer-core"))
        ],
        actionItems: [
          insightAction("핵심 고객군 인사이트 보기", "insight-customer-claims"),
          metricAction("클레임률 보기", "metric-claim-rate"),
          objectAction("핵심 고객군 관리 대상 보기", "entity-customer-core")
        ],
        sampleDataLabel
      };
    case "supplier-a-impact":
    default:
      return {
        id: scenarioId,
        prompt: scenario.prompt,
        shortLabel: scenario.shortLabel,
        title: "공급업체 A사 영향 분석",
        subtitle: "납품 준수율과 평균 출고 대기시간을 기반으로 P-42 공급 리스크를 canvas로 요약합니다.",
        summary: [
          "공급업체 A사는 현재 P-42 제품의 출고 지연과 생산 병목에 직접적인 영향을 주는 핵심 공급 리스크로 판단됩니다.",
          `최근 데이터 기준으로 A사와 연결된 P-42의 납품 준수율은 70~72% 수준으로 낮고, 평균 출고 대기시간은 ${formatMetric(state, "metric-delay-time")}까지 증가했습니다.`,
          "이 영향은 출고 일정 지연, 긴급 대응 비용 증가, 고객 납기 불안정, 내부 운영관리 부담 증가로 이어질 가능성이 있습니다."
        ],
        confidence: confidenceFromEvidence(evidence, 0.92),
        confidenceLabel: "공급·주문·마진 근거 확인",
        metricSummaries: metricSummariesFor(state, ["metric-delay-time", "metric-margin"]),
        visualBlocks: [
          supplierComplianceBlock(),
          metricPreviousCurrentBlock(state, "metric-delay-time", "visual-supplier-a-delay-time", "평균 출고 대기시간", "이전 26시간에서 현재 36.8시간으로 늘어난 출고 대기시간 증가를 강조합니다."),
          ...metricBlocksFor(state, [
            ["metric-margin", "visual-canvas-supplier-margin", "P-42 평균 마진"],
            ["metric-claim-rate", "visual-canvas-supplier-claim-rate", "고객 영향 클레임률"]
          ])
        ],
        evidence,
        keyFindings: [
          "A사는 P-42 출고 지연과 생산 병목에 직접 연결된 공급 리스크입니다.",
          "납품 준수율은 70~72% 수준이고 평균 출고 대기시간은 36.8시간까지 증가했습니다.",
          "출고 일정, 긴급 대응 비용, 고객 납기 안정성에 동시 영향을 줄 수 있습니다."
        ],
        detailTable: supplierImpactTable(state),
        recommendations: [
          recommendation("supplier-terms", "A사 납품 조건 재확인", "납품 준수율과 처리 시간 기준으로 개선 조건을 확인합니다.", "지연률 감소", "danger", objectAction("공급업체 A사 보기", "entity-supplier-a")),
          recommendation("supplier-alt", "P-42 대체 공급 검토", "정상 사례와 대체 공급 가능성을 비교합니다.", "공급 리스크 분산", "warning", objectAction("P-42 관리 대상 보기", "entity-low-margin")),
          recommendation("supplier-watch", "2주간 지표 모니터링", "납품 준수율과 출고 대기시간을 같은 주기로 추적합니다.", "개선 여부 확인", "info", metricAction("평균 출고 대기시간 보기", "metric-delay-time"))
        ],
        actionItems: [
          objectAction("공급업체 A사 보기", "entity-supplier-a"),
          objectAction("P-42 관리 대상 보기", "entity-low-margin"),
          metricAction("평균 출고 대기시간 보기", "metric-delay-time")
        ],
        sampleDataLabel
      };
  }
}

function evidenceFor(state: PrototypeState, evidenceIds: string[] = []): EvidenceReference[] {
  const idSet = new Set(evidenceIds);
  return state.evidence.filter((item) => idSet.has(item.id));
}

function evidenceIdsForScenario(scenarioId: FixedScenarioId): string[] {
  const ids: Record<FixedScenarioId, string[]> = {
    "customer-a-claims": ["evidence-claims", "evidence-orders-delay"],
    "highest-risk-signal": ["evidence-margin", "evidence-claims", "evidence-supplier"],
    "p42-margin-cause": ["evidence-margin", "evidence-supplier"],
    "supplier-a-impact": ["evidence-supplier", "evidence-orders-delay", "evidence-margin"]
  };

  return ids[scenarioId];
}

function confidenceFromEvidence(evidence: EvidenceReference[], fallback: number): number {
  const values = evidence.map((item) => item.confidence).filter((value): value is number => typeof value === "number");
  if (values.length === 0) {
    return fallback;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metricSummariesFor(state: PrototypeState, metricIds: string[]): AiCanvasMetricSummary[] {
  return metricIds.map((metricId) => {
    const definition = metricDefinition(state, metricId);
    const value = metricValue(state, metricId);
    const delta = value ? value.value - value.previousValue : 0;
    return {
      id: metricId,
      label: definition?.name ?? metricId,
      value: value && definition ? `${value.value}${definition.unit}` : "-",
      detail: value && definition ? `이전 ${value.previousValue}${definition.unit} 대비 ${delta > 0 ? "+" : ""}${Number(delta.toFixed(1))}${definition.unit}` : "지표 없음",
      tone: metricTone(value?.status)
    };
  });
}

function metricBlocksFor(state: PrototypeState, items: Array<[string, string, string]>): AiChatVisualBlock[] {
  return items.map(([metricId, id, title]) => {
    const definition = metricDefinition(state, metricId);
    const value = metricValue(state, metricId);
    return {
      id,
      type: "metric_chart",
      title,
      description: definition?.formula,
      chartType: value?.chartType && value.chartType !== "table" ? value.chartType : "bar",
      points: chartPoints(definition?.name ?? title, value),
      status: value?.status ?? "normal",
      unit: definition?.unit ?? ""
    };
  });
}

function chartPoints(metricName: string, value?: MetricValue) {
  if (!value) {
    return [];
  }

  if (value.series.length > 0) {
    return value.series.map((point) => ({
      label: point.label,
      value: point.value,
      observedAt: point.observedAt
    }));
  }

  return [
    { label: "이전", value: value.previousValue },
    { label: metricName, value: value.value }
  ];
}

function metricVisualBlock(
  state: PrototypeState,
  metricId: string,
  options: { description?: string; id: string; title: string }
): AiChatVisualBlock {
  const definition = metricDefinition(state, metricId);
  const value = metricValue(state, metricId);

  return {
    id: options.id,
    type: "metric_chart",
    title: options.title,
    description: options.description,
    chartType: chartTypeForVisual(value?.chartType),
    points: chartPoints(definition?.name ?? "현재", value),
    status: value?.status ?? "normal",
    unit: definition?.unit ?? ""
  };
}

function metricPreviousCurrentBlock(
  state: PrototypeState,
  metricId: string,
  id: string,
  title: string,
  description: string
): AiChatVisualBlock {
  const definition = metricDefinition(state, metricId);
  const value = metricValue(state, metricId);

  return {
    id,
    type: "metric_chart",
    title,
    description,
    chartType: "bar",
    points: previousCurrentPoints(value, "이전", "현재"),
    status: value?.status ?? "normal",
    unit: definition?.unit ?? ""
  };
}

function previousCurrentPoints(value: MetricValue | undefined, previousLabel: string, currentLabel: string) {
  if (!value) {
    return [];
  }

  return [
    { label: previousLabel, value: value.previousValue },
    { label: currentLabel, value: value.value }
  ];
}

function supplierComplianceBlock(): AiChatVisualBlock {
  return {
    id: "visual-supplier-a-compliance",
    type: "metric_chart",
    title: "A사 납품 준수율",
    description: "A사와 연결된 P-42 납품 준수율 72%를 준수/미준수 비율로 나눠 봅니다.",
    chartType: "pie",
    points: [
      { label: "준수", value: 72 },
      { label: "미준수", value: 28 }
    ],
    status: "warning",
    unit: "%"
  };
}

function comparisonVisualBlock(
  id: string,
  title: string,
  rows: Array<{ detail?: string; label: string; tone?: AiChatVisualTone; value: string }>,
  description?: string
): AiChatVisualBlock {
  return {
    id,
    type: "comparison",
    title,
    description,
    rows
  };
}

function chartTypeForVisual(chartType?: MetricValue["chartType"]): Exclude<MetricValue["chartType"], "table"> {
  return chartType && chartType !== "table" ? chartType : "bar";
}

function riskPriorityTable(state: PrototypeState): AiCanvasDetailTable {
  return {
    title: "위험 신호 우선순위",
    caption: "현재 데이터에서 영향도와 지표 악화 폭을 함께 본 정렬입니다.",
    columns: ["순위", "대상", "핵심 지표", "해석"],
    rows: [
      { id: "risk-1", cells: ["1", "P-42 마진 구조", formatMetric(state, "metric-margin"), "수익성 하락과 반품비용이 직접 연결"], tone: "danger" },
      { id: "risk-2", cells: ["2", "핵심 고객군 클레임", formatMetric(state, "metric-claim-rate"), "반복 보상 요청과 이탈 위험 확대"], tone: "danger" },
      { id: "risk-3", cells: ["3", "공급업체 A사", formatMetric(state, "metric-delay-time"), "납품 준수율과 출고 대기시간 악화"], tone: "warning" }
    ]
  };
}

function supplierImpactTable(state: PrototypeState): AiCanvasDetailTable {
  return {
    title: "공급 영향 상세",
    caption: "A사와 P-42 흐름에서 확인된 근거를 기준으로 정리합니다.",
    columns: ["항목", "현재 값", "영향", "다음 확인"],
    rows: [
      { id: "supplier-compliance", cells: ["납품 준수율", "72%", "출고 일정 지연", "A사 납품 조건"], tone: "warning" },
      { id: "supplier-delay", cells: ["평균 출고 대기시간", formatMetric(state, "metric-delay-time"), "긴급 대응 비용 증가", "2주 모니터링"], tone: "danger" },
      { id: "supplier-margin", cells: ["P-42 마진", formatMetric(state, "metric-margin"), "수익성 압박", "대체 공급 가능성"], tone: "warning" }
    ]
  };
}

function marginFactorsTable(state: PrototypeState): AiCanvasDetailTable {
  const margin = metricValue(state, "metric-margin");
  return {
    title: "마진 하락 요인",
    caption: "P-42 마진에 영향을 준 요인을 분리합니다.",
    columns: ["요인", "값", "판단", "연결 지표"],
    rows: [
      { id: "margin-discount", cells: ["할인율", String(margin?.basis?.discountRange ?? "6.4~6.8%"), "상품군 주문에 적용된 할인 압박", formatMetric(state, "metric-margin")], tone: "warning" },
      { id: "margin-return", cells: ["반품비용", formatCurrencyManwon(margin?.basis?.returnCost), "마진을 직접 낮추는 비용", formatMetric(state, "metric-margin")], tone: "danger" },
      { id: "margin-delay", cells: ["공급 지연", formatMetric(state, "metric-delay-time"), "긴급 대응 비용 가능성", formatMetric(state, "metric-delay-time")], tone: "warning" }
    ]
  };
}

function customerClaimsTable(state: PrototypeState): AiCanvasDetailTable {
  return {
    title: "핵심 고객군 영향 상세",
    caption: "클레임률과 평균 출고 대기시간의 동시 악화 흐름입니다.",
    columns: ["항목", "현재 값", "영향", "권장 대응"],
    rows: [
      { id: "claims-rate", cells: ["클레임률", formatMetric(state, "metric-claim-rate"), "보상 요청 반복", "선제 안내"], tone: "danger" },
      { id: "claims-delay", cells: ["평균 출고 대기시간", formatMetric(state, "metric-delay-time"), "배송 지연 체감", "납기 사유 공유"], tone: "warning" },
      { id: "claims-customer", cells: ["반복 구매 고객군", "핵심 고객군", "이탈 위험 증가", "보상 기준 조정"], tone: "warning" }
    ]
  };
}

function metricDefinition(state: PrototypeState, metricId: string): MetricDefinition | undefined {
  return state.metricDefinitions.find((metric) => metric.id === metricId);
}

function metricValue(state: PrototypeState, metricId: string): MetricValue | undefined {
  return state.metricValues.find((value) => value.metricId === metricId);
}

function metricLine(state: PrototypeState, metricId: string): string {
  const definition = metricDefinition(state, metricId);
  const value = metricValue(state, metricId);
  if (!definition || !value) {
    return "";
  }

  const status = value.status === "critical" ? "위험" : value.status === "warning" ? "주의" : "정상";
  const trend = value.trend === "up" ? "상승" : value.trend === "down" ? "하락" : "유지";
  return `${definition.name} ${value.value}${definition.unit}(${status}, ${trend})`;
}

function metricDeltaDetail(state: PrototypeState, metricId: string): string {
  const definition = metricDefinition(state, metricId);
  const value = metricValue(state, metricId);
  if (!definition || !value) {
    return "비교 가능한 지표 없음";
  }

  const delta = Number((value.value - value.previousValue).toFixed(1));
  const sign = delta > 0 ? "+" : "";
  return `이전 ${value.previousValue}${definition.unit} -> 현재 ${value.value}${definition.unit} (${sign}${delta}${definition.unit})`;
}

function formatMetric(state: PrototypeState, metricId: string): string {
  const definition = metricDefinition(state, metricId);
  const value = metricValue(state, metricId);
  if (!definition || !value) {
    return "-";
  }

  return `${value.value}${definition.unit}`;
}

function discountRange(state: PrototypeState): string {
  const value = metricValue(state, "metric-margin")?.basis?.discountRange;
  return typeof value === "string" ? value : "6.4~6.8%";
}

function formatCurrencyManwon(value: number | string | undefined): string {
  return typeof value === "number" ? `${Math.round(value / 10000).toLocaleString("ko-KR")}만원` : "-";
}

function metricTone(status?: MetricValue["status"]): AiChatVisualTone {
  if (status === "critical") {
    return "danger";
  }

  if (status === "warning") {
    return "warning";
  }

  return "success";
}

function recommendation(
  id: string,
  title: string,
  description: string,
  impact: string,
  tone: AiChatVisualTone,
  action?: AiChatAction
): AiCanvasRecommendation {
  return { id, title, description, impact, tone, action };
}

function insightAction(label: string, insightId: string): AiChatAction {
  return {
    label,
    target: { screen: "insightDetail", focusId: insightId, label }
  };
}

function metricAction(label: string, metricId: string): AiChatAction {
  return {
    label,
    target: { screen: "metrics", focusId: metricId, label }
  };
}

function objectAction(label: string, objectId: string): AiChatAction {
  return {
    label,
    target: { screen: "objects", focusId: objectId, label }
  };
}
