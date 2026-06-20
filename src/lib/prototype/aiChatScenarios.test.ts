import assert from "node:assert/strict";
import test from "node:test";
import { initialPrototypeState } from "../domain/mock-data";
import { createAssistantMessageFromPending, createUserMessage } from "../../features/ai-chat/aiChatMessages";
import { aiChatScenarios, buildAiChatResponse, findAiChatScenario } from "../../features/ai-chat/aiChatScenarios";
import type { AiChatPendingAssistant, AiChatVisualBlock } from "../../features/ai-chat/aiChatTypes";

test("supplier A impact is the first recommended ai chat question", () => {
  assert.equal(aiChatScenarios[0]?.id, "supplier-a-impact");
  assert.equal(aiChatScenarios[0]?.prompt, "공급업체 A사가 어떤 영향을 줘?");
});

test("ai chat scenario answers include fixture citations and navigation actions", () => {
  const response = buildAiChatResponse({
    attachments: [],
    question: "현재 가장 위험한 운영 신호는?",
    state: initialPrototypeState
  });

  assert.equal(response.scenarioId, "highest-risk-signal");
  assert.match(response.content, /P-42/);
  assert.ok(response.citationEvidenceIds?.includes("evidence-margin"));
  assert.ok(response.citationEvidenceIds?.includes("evidence-claims"));
  assert.ok(response.actionItems?.some((action) => action.target?.screen === "metrics" && action.target.focusId === "metric-margin"));
  assert.ok(response.visualBlocks?.some((block) => block.type === "comparison" && block.id === "visual-highest-risk-priority"));
});

test("ai chat scenario matching handles typed aliases", () => {
  const scenario = findAiChatScenario("공급업체 A 영향 알려줘");

  assert.equal(scenario?.id, "supplier-a-impact");
});

test("supplier A impact answer follows the requested operator-facing copy", () => {
  const response = buildAiChatResponse({
    attachments: [],
    question: "공급업체 A사가 어떤 영향을 줘?",
    state: initialPrototypeState
  });

  assert.equal(response.scenarioId, "supplier-a-impact");
  assert.match(response.content, /핵심 공급 리스크/);
  assert.match(response.content, /납품 준수율은 70~72%/);
  assert.match(response.content, /추천 다음 액션/);
  assert.match(response.content, /4\. 개선이 없을 경우 공급 조건 재협의 또는 대체 공급사 병행 검토/);
  assert.ok(response.visualBlocks?.some((block) => block.type === "metric_chart" && block.id === "visual-supplier-a-compliance" && block.chartType === "pie"));
  assert.ok(response.visualBlocks?.some((block) => block.type === "metric_chart" && block.id === "visual-supplier-a-delay-time" && block.chartType === "bar"));
});

test("ai chat source scenario exposes source file attachment ids without file payloads", () => {
  const response = buildAiChatResponse({
    attachments: [],
    question: "어떤 근거 파일을 봐야 해?",
    state: initialPrototypeState
  });

  assert.ok(response.actionItems?.some((action) => action.screen === "vault"));
  assert.equal(JSON.stringify(response).includes("dataUrl"), false);
  assert.equal(JSON.stringify(response).includes("textContent"), false);
});

test("ai chat fallback reflects local file attachments without file payloads or sizes", () => {
  const response = buildAiChatResponse({
    attachments: [{ id: "file-1", name: "운영질문.pdf", type: "application/pdf" }],
    question: "이 맥락으로 더 설명해줘",
    state: initialPrototypeState
  });

  assert.match(response.content, /운영질문\.pdf/);
  assert.match(response.content, /파일 원문을 새로 분석하지 않고/);
  assert.equal(JSON.stringify(response).includes("size"), false);
});

test("ai chat visual payload is preserved when pending assistant completes", () => {
  const visualBlocks: AiChatVisualBlock[] = [
    {
      id: "visual-risk-metrics",
      type: "metric_chart",
      title: "위험 지표 비교",
      chartType: "bar",
      status: "critical",
      unit: "%",
      points: [
        { label: "마진", value: 14.8 },
        { label: "클레임", value: 8.7 }
      ]
    },
    {
      id: "visual-risk-ranking",
      type: "comparison",
      title: "우선순위 해석",
      rows: [
        { label: "1순위", value: "P-42 마진 구조", tone: "danger" },
        { label: "2순위", value: "고객A 클레임", tone: "warning" }
      ]
    }
  ];
  const pending: AiChatPendingAssistant = {
    id: "assistant-visual",
    role: "assistant",
    content: "표시 중",
    fullContent: "완료된 답변",
    displayContent: "완료된 답변",
    createdAt: "2026-06-20T01:00:00.000Z",
    phase: "streaming",
    visualBlocks
  };

  const completed = createAssistantMessageFromPending(pending);

  assert.equal(completed.content, "완료된 답변");
  assert.deepEqual(completed.visualBlocks, visualBlocks);
});

test("ai chat user messages do not carry visual blocks", () => {
  const userMessage = createUserMessage({
    id: "user-visual-exclusion",
    content: "현재 위험 신호는?",
    createdAt: "2026-06-20T01:00:00.000Z",
    attachments: []
  });

  assert.equal(userMessage.role, "user");
  assert.equal("visualBlocks" in userMessage, false);
});

test("ai chat fixture scenarios expose visual explanation payloads", () => {
  const supplierResponse = buildAiChatResponse({
    attachments: [],
    question: "공급업체 A사가 어떤 영향을 줘?",
    state: initialPrototypeState
  });
  const marginResponse = buildAiChatResponse({
    attachments: [],
    question: "P-42 마진이 왜 낮아졌어?",
    state: initialPrototypeState
  });
  const claimsResponse = buildAiChatResponse({
    attachments: [],
    question: "고객A 클레임 원인은?",
    state: initialPrototypeState
  });

  assert.ok(supplierResponse.visualBlocks?.some((block) => block.type === "metric_chart" && block.chartType === "pie"));
  assert.ok(supplierResponse.visualBlocks?.some((block) => block.type === "metric_chart" && block.chartType === "bar" && block.points.some((point) => point.label === "현재" && point.value === 36.8)));
  assert.ok(marginResponse.visualBlocks?.some((block) => block.type === "metric_chart" && block.chartType === "bar"));
  assert.ok(marginResponse.visualBlocks?.some((block) => block.type === "comparison" && block.rows.some((row) => row.label === "반품비용")));
  assert.ok(claimsResponse.visualBlocks?.some((block) => block.type === "metric_chart" && block.chartType === "time_series"));
  assert.ok(claimsResponse.visualBlocks?.some((block) => block.type === "comparison" && block.rows.some((row) => row.label === "주문 처리 시간")));
});
