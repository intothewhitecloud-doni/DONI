import type { MetricDefinition, MetricValue, PrototypeState, SourceFile } from "../../lib/domain/types";
import type { AiChatAction, AiChatAttachment, AiChatScenarioResponse } from "./aiChatTypes";

type AiChatScenarioContext = {
  attachments: AiChatAttachment[];
  question: string;
  state: PrototypeState;
};

type AiChatScenario = {
  aliases: string[];
  buildResponse: (context: AiChatScenarioContext) => AiChatScenarioResponse;
  id: string;
  prompt: string;
  shortLabel: string;
};

// Prototype Q&A behavior is intentionally centralized here so future question,
// answer, source, and action changes do not require editing the chat panel UI.
export const aiChatScenarios: AiChatScenario[] = [
  {
    id: "supplier-a-impact",
    prompt: "공급업체 A사가 어떤 영향을 줘?",
    shortLabel: "공급업체 A사",
    aliases: ["공급업체 a", "공급업체 A", "공급사", "납품", "출고 지연", "납품준수율"],
    buildResponse: () => ({
      scenarioId: "supplier-a-impact",
      content: [
        "공급업체 A사는 현재 P-42 제품의 출고 지연과 생산 병목에 직접적인 영향을 주는 핵심 공급 리스크로 판단됩니다.",
        "최근 데이터 기준으로 A사와 연결된 P-42의 납품 준수율은 70~72% 수준으로 낮고, 평균 주문 처리 시간은 36.8시간까지 증가했습니다.",
        "이 영향은 출고 일정 지연, 긴급 대응 비용 증가, 고객 납기 불안정, 내부 운영관리 부담 증가로 이어질 가능성이 있습니다.",
        "따라서 A사는 현재 '관리 필요 공급업체'로 분류하는 것이 적절합니다.",
        [
          "추천 다음 액션",
          "",
          "1. A사 납품 조건 재확인",
          "2. P-42 대체 공급 가능성 검토",
          "3. 2주간 납품 준수율과 주문 처리 시간 모니터링",
          "4. 개선이 없을 경우 공급 조건 재협의 또는 대체 공급사 병행 검토"
        ].join("\n")
      ].join("\n\n"),
      citationEvidenceIds: ["evidence-supplier", "evidence-orders-delay", "evidence-margin"]
    })
  },
  {
    id: "highest-risk-signal",
    prompt: "현재 가장 위험한 운영 신호는?",
    shortLabel: "위험 신호",
    aliases: ["가장 위험", "위험한 운영", "운영 신호", "리스크", "위험 신호", "critical"],
    buildResponse: ({ state }) => {
      const margin = metricLine(state, "metric-margin");
      const delay = metricLine(state, "metric-delay-time");
      const claim = metricLine(state, "metric-claim-rate");
      return {
        scenarioId: "highest-risk-signal",
        content: [
          "현재 fixture 기준 가장 큰 신호는 P-42에 집중된 수익성 하락과 고객 영향입니다.",
          `${margin} ${delay} ${claim}`,
          "세 지표가 같은 상품군과 고객 흐름에 겹쳐 있고, 인사이트도 P-42 마진 하락과 고객A 클레임 반복을 높은 영향으로 보고 있습니다.",
          "우선순위는 P-42 마진 구조 점검, 고객A 선제 안내, 공급업체 A사 납품 조건 재협의 순서가 적절합니다."
        ].join("\n\n"),
        citationEvidenceIds: ["evidence-margin", "evidence-claims", "evidence-supplier"],
        actionItems: [
          insightAction("P-42 인사이트 보기", "insight-product-margin"),
          metricAction("평균 마진율 보기", "metric-margin"),
          metricAction("클레임률 보기", "metric-claim-rate")
        ]
      };
    }
  },
  {
    id: "p42-margin-cause",
    prompt: "P-42 마진이 왜 낮아졌어?",
    shortLabel: "P-42 마진",
    aliases: ["p-42 마진", "p42 마진", "마진 낮", "마진 하락", "평균 마진율", "수익성"],
    buildResponse: ({ state }) => {
      const margin = metricValue(state, "metric-margin");
      const supplierRelation = state.relations.find((relation) => relation.id === "relation-supplier-product");
      return {
        scenarioId: "p42-margin-cause",
        content: [
          `P-42 평균 마진율은 ${formatMetricValue(state, "metric-margin")}로 이전 ${margin?.previousValue ?? "-"}%보다 낮습니다.`,
          "fixture의 계산 근거는 할인율 6.4~6.8%, 반품비용 880만원, 공급 지연으로 인한 비용 압박을 함께 보고 있습니다.",
          supplierRelation
            ? `${supplierRelation.description} 이 연결은 ${confidenceLabel(supplierRelation.confidence)} 신뢰도로 표시됩니다.`
            : "공급업체 A사와 P-42 공급 관계가 비용 압박 경로로 연결됩니다.",
          "따라서 단순 가격 문제가 아니라 할인, 반품, 공급 지연이 겹친 상품군 단위 이슈로 보는 편이 맞습니다."
        ].join("\n\n"),
        citationEvidenceIds: ["evidence-margin", "evidence-supplier"],
        actionItems: [
          metricAction("평균 마진율 보기", "metric-margin"),
          insightAction("마진 인사이트 보기", "insight-product-margin"),
          objectAction("P-42 관리 대상 보기", "entity-low-margin")
        ]
      };
    }
  },
  {
    id: "customer-a-claims",
    prompt: "고객A 클레임 원인은?",
    shortLabel: "고객A 클레임",
    aliases: ["고객a", "고객 A", "클레임 원인", "보상 요청", "이탈 위험", "고객 클레임"],
    buildResponse: ({ state }) => {
      const insight = state.insights.find((item) => item.id === "insight-customer-claims");
      return {
        scenarioId: "customer-a-claims",
        content: [
          "고객A 클레임은 P-42 배송 지연 이후 반복된 보상 요청과 연결됩니다.",
          `현재 클레임률은 ${formatMetricValue(state, "metric-claim-rate")}이고 주문 처리 시간도 ${formatMetricValue(state, "metric-delay-time")}까지 늘어난 상태입니다.`,
          insight?.reason ?? "반복 구매 고객군에서 배송 지연과 보상 요청이 같이 나타나 이탈 위험과 대응 비용이 커집니다.",
          "우선 고객A에는 선제 안내를 발송하고, 보상 기준을 고객군 영향도에 맞춰 조정하는 답변이 fixture의 추천 조치와 맞습니다."
        ].join("\n\n"),
        citationEvidenceIds: ["evidence-claims", "evidence-orders-delay"],
        actionItems: [
          insightAction("고객A 인사이트 보기", "insight-customer-claims"),
          metricAction("클레임률 보기", "metric-claim-rate"),
          objectAction("고객A 관리 대상 보기", "entity-customer-core")
        ]
      };
    }
  },
  {
    id: "source-files",
    prompt: "어떤 근거 파일을 봐야 해?",
    shortLabel: "근거 파일",
    aliases: ["근거 파일", "출처", "source", "파일", "증거", "evidence", "어떤 근거"],
    buildResponse: ({ state }) => {
      const sourceSummary = state.sourceFiles.map(sourceFileSummary).join("\n");
      return {
        scenarioId: "source-files",
        content: [
          "현재 분석 근거는 두 개의 sample 파일에 집중되어 있습니다.",
          sourceSummary || "표시할 보관 파일이 없습니다.",
          "주문/클레임 흐름은 주문_배송_클레임.xlsx를, 마진과 공급사 비교는 상품별_마진_공급사.csv를 먼저 보면 됩니다."
        ].join("\n\n"),
        citationEvidenceIds: ["evidence-orders-delay", "evidence-claims", "evidence-margin", "evidence-supplier"],
        actionItems: [{ label: "데이터 보관함 열기", screen: "vault" }]
      };
    }
  },
  {
    id: "next-actions",
    prompt: "다음 조치는 뭐야?",
    shortLabel: "다음 조치",
    aliases: ["다음 조치", "무엇을 해야", "액션", "대응", "추천 조치", "우선순위"],
    buildResponse: ({ state }) => {
      const actions = [
        ...recommendedActionsFor(state, "insight-customer-claims").slice(0, 2),
        ...recommendedActionsFor(state, "insight-supplier-delay").slice(0, 2),
        ...recommendedActionsFor(state, "insight-product-margin").slice(0, 2)
      ];
      return {
        scenarioId: "next-actions",
        content: [
          "fixture 기준 다음 조치는 고객 영향, 공급 지연, 상품 마진을 나눠 처리하는 것이 좋습니다.",
          numbered(actions),
          "안건으로 전환할 때는 P-42 마진 구조 조정안 또는 고객A 선제 안내안을 먼저 검토하는 흐름이 자연스럽습니다."
        ].join("\n\n"),
        citationEvidenceIds: ["evidence-claims", "evidence-supplier", "evidence-margin"],
        actionItems: [
          insightAction("P-42 인사이트에서 검토", "insight-product-margin"),
          { label: "인사이트 목록 보기", target: { screen: "insights", label: "인사이트 목록 보기" } },
          { label: "안건 초안 화면 열기", screen: "proposalCreate" }
        ]
      };
    }
  },
  {
    id: "normal-comparison",
    prompt: "P-42와 비교할 정상 사례는?",
    shortLabel: "비교 사례",
    aliases: ["비교", "정상 사례", "p-17", "p-08", "고객b", "공급업체 b", "대조군"],
    buildResponse: () => ({
      scenarioId: "normal-comparison",
      content: [
        "P-42와 비교할 정상/보조 사례는 P-17, P-08, 고객B, 공급업체 B사입니다.",
        "P-17 표준 제어 모듈은 평균 마진율 21.2%와 안정적인 납품 흐름을 가진 비교 상품군입니다.",
        "P-08 정밀 부품 세트는 공급업체 A사가 함께 공급하지만 고객B 주문에서는 정상 배송과 무클레임 흐름이 확인됩니다.",
        "이 비교는 공급사 리스크가 전체 공급업체 A사 문제인지, P-42에 집중된 상품군 문제인지 분리하는 데 유용합니다."
      ].join("\n\n"),
      citationEvidenceIds: ["evidence-customer-b-p08", "evidence-supplier", "evidence-margin"],
      actionItems: [
        objectAction("P-17 보기", "entity-product-control"),
        objectAction("P-08 보기", "entity-product-precision"),
        objectAction("공급업체 B사 보기", "entity-supplier-b")
      ]
    })
  }
];

export function buildAiChatResponse(context: AiChatScenarioContext): AiChatScenarioResponse {
  const scenario = findAiChatScenario(context.question);
  if (scenario) {
    return scenario.buildResponse(context);
  }

  return buildFallbackResponse(context);
}

export function findAiChatScenario(question: string): AiChatScenario | undefined {
  const normalized = normalizeText(question);
  if (!normalized) {
    return undefined;
  }

  return aiChatScenarios.find((scenario) => {
    if (normalizeText(scenario.prompt) === normalized) {
      return true;
    }

    return scenario.aliases.some((alias) => normalized.includes(normalizeText(alias)));
  });
}

function buildFallbackResponse({ attachments }: AiChatScenarioContext): AiChatScenarioResponse {
  const attachedText = attachments.length > 0
    ? `첨부한 파일 ${attachments.map((file) => file.name).join(", ")}을 함께 둔 상태로 답변합니다. 현재 화면은 파일 원문을 새로 분석하지 않고 문맥 포함 상태만 표시합니다.`
    : "질문을 P-42, 고객A, 공급업체 A사, 마진, 클레임, 출처 파일 중 하나와 연결하면 더 구체적으로 답변할 수 있습니다.";

  return {
    content: [
      attachedText,
      "현재 가장 잘 답변할 수 있는 범위는 P-42 마진 하락, 고객A 클레임, 공급업체 A사 지연, 근거 파일, 다음 조치, 정상 비교 사례입니다."
    ].join("\n\n"),
    citationEvidenceIds: ["evidence-margin", "evidence-claims", "evidence-supplier"],
    actionItems: [
      insightAction("대표 인사이트 보기", "insight-product-margin"),
      { label: "지표 화면 보기", screen: "metrics" }
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

function formatMetricValue(state: PrototypeState, metricId: string): string {
  const definition = metricDefinition(state, metricId);
  const value = metricValue(state, metricId);
  if (!definition || !value) {
    return "-";
  }

  return `${value.value}${definition.unit}`;
}

function confidenceLabel(confidence?: number): string {
  if (typeof confidence !== "number") {
    return "표시된";
  }

  return `${Math.round(confidence * 100)}%`;
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

function sourceFileSummary(file: SourceFile): string {
  return `- ${file.name}: ${file.rowCount.toLocaleString("ko-KR")}행, ${file.kind}`;
}

function recommendedActionsFor(state: PrototypeState, insightId: string): string[] {
  return state.insights.find((insight) => insight.id === insightId)?.recommendedActions ?? [];
}

function numbered(items: string[]): string {
  if (items.length === 0) {
    return "1. 관련 인사이트와 지표를 먼저 확인합니다.";
  }

  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "").replace(/[?.!,]/g, "");
}
