import assert from "node:assert/strict";
import test from "node:test";
import { initialPrototypeState } from "../domain/mock-data";
import { aiChatScenarios, buildAiChatResponse, findAiChatScenario } from "../../features/ai-chat/aiChatScenarios";

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
